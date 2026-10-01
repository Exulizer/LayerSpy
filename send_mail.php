<?php
// send_mail.php - High Security Contact Form Backend
header('Content-Type: application/json; charset=utf-8');
session_start();

if ($_SERVER["REQUEST_METHOD"] === "POST") {
    // 1. IP-basiertes Rate-Limiting (Max. 3 Nachrichten pro 10 Minuten)
    $ip = $_SERVER['REMOTE_ADDR'] ?? 'unknown';
    $rate_limit_dir = sys_get_temp_dir() . '/layerspy_mail_limits';
    if (!is_dir($rate_limit_dir)) {
        @mkdir($rate_limit_dir, 0755, true);
    }
    $rate_file = $rate_limit_dir . '/ip_' . md5($ip) . '.json';
    $now = time();
    $attempts = [];

    if (file_exists($rate_file)) {
        $data = json_decode(file_get_contents($rate_file), true);
        if (is_array($data)) {
            $attempts = array_filter($data, function($timestamp) use ($now) {
                return ($now - $timestamp) < 600; // 10 Minuten Fenster
            });
        }
    }

    if (count($attempts) >= 3) {
        http_response_code(429);
        echo json_encode(["status" => "error", "message" => "Zu viele Anfragen. Bitte warten Sie einige Minuten."]);
        exit;
    }

    // 2. Multi-Honeypot Prüfung (Unsichtbare Felder)
    $honeypot1 = trim($_POST["website_url"] ?? '');
    $honeypot2 = trim($_POST["company_fax"] ?? '');
    if (!empty($honeypot1) || !empty($honeypot2)) {
        // Stille Ablehnung (Bot denkt, es hat geklappt)
        http_response_code(200);
        echo json_encode(["status" => "success", "message" => "Nachricht gesendet."]);
        exit;
    }

    // 3. Time-Trap (Mindestsendezeit: Ein Mensch braucht mindestens 3 Sekunden)
    $form_load_time = intval($_POST["form_time"] ?? 0);
    if ($form_load_time <= 0 || ($now - $form_load_time) < 3) {
        // Zu schnell = Bot
        http_response_code(200);
        echo json_encode(["status" => "success", "message" => "Nachricht gesendet."]);
        exit;
    }

    // 4. Mathematische Sicherheitsfrage (Captcha-Ersatz)
    $captcha_answer = intval(trim($_POST["math_answer"] ?? -999));
    $captcha_token = trim($_POST["math_token"] ?? '');
    
    // Validierung des Mathe-Tokens
    $expected_answer = null;
    if (!empty($captcha_token) && isset($_SESSION['math_captcha'][$captcha_token])) {
        $expected_answer = $_SESSION['math_captcha'][$captcha_token];
        unset($_SESSION['math_captcha'][$captcha_token]); // Einmalig verwenden
    }

    if ($expected_answer === null || $captcha_answer !== $expected_answer) {
        http_response_code(400);
        echo json_encode(["status" => "error", "message" => "Die Sicherheitsrechenaufgabe war leider nicht korrekt."]);
        exit;
    }

    // 5. Eingabedaten sammeln & bereinigen
    $name = strip_tags(trim($_POST["name"] ?? ''));
    $email = filter_var(trim($_POST["email"] ?? ''), FILTER_SANITIZE_EMAIL);
    $message = trim($_POST["message"] ?? '');

    if (empty($name) || empty($message) || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
        http_response_code(400);
        echo json_encode(["status" => "error", "message" => "Bitte füllen Sie alle Felder korrekt aus."]);
        exit;
    }

    if (mb_strlen($name) < 2 || mb_strlen($message) < 10) {
        http_response_code(400);
        echo json_encode(["status" => "error", "message" => "Ihre Nachricht ist zu kurz."]);
        exit;
    }

    // 6. Content- & Spam-Keyword Filter (SEO-Spam, Crypto, Casino, kyrillische Bots)
    $spam_patterns = [
        '/\b(viagra|cialis|crypto|bitcoin|casino|poker|seo\s+ranking|guest\s+post|backlink|web\s+design\s+service|ranking\s+on\s+google)\b/i',
        '/[\x{0400}-\x{04FF}]/u', // Kyrillische Schriftzeichen (Russischer Bot-Spam)
        '/<script\b[^>]*>(.*?)<\/script>/is'
    ];

    foreach ($spam_patterns as $pattern) {
        if (preg_match($pattern, $message) || preg_match($pattern, $name)) {
            // Stille Ablehnung
            http_response_code(200);
            echo json_encode(["status" => "success", "message" => "Nachricht gesendet."]);
            exit;
        }
    }

    // Max. 2 URLs in der Nachricht erlauben (verhindert Link-Drop Bots)
    $url_count = preg_match_all('/https?:\/\//i', $message);
    if ($url_count > 2) {
        http_response_code(200);
        echo json_encode(["status" => "success", "message" => "Nachricht gesendet."]);
        exit;
    }

    // 7. Rate-Limit Counter aktualisieren
    $attempts[] = $now;
    @file_put_contents($rate_file, json_encode($attempts));

    // 8. E-Mail Einstellungen & Versand
    $recipient = "info@layerspy.de";
    $subject = "LayerSpy Kontaktanfrage: " . mb_substr($name, 0, 40);
    
    $clean_msg = htmlspecialchars($message, ENT_QUOTES, 'UTF-8');
    $clean_name = htmlspecialchars($name, ENT_QUOTES, 'UTF-8');

    $email_content = "Neue Kontaktanfrage über www.layerspy.de\n";
    $email_content .= "===========================================\n\n";
    $email_content .= "Name:   $clean_name\n";
    $email_content .= "E-Mail: $email\n";
    $email_content .= "IP:     $ip\n";
    $email_content .= "Datum:  " . date('d.m.Y H:i:s') . "\n\n";
    $email_content .= "Nachricht:\n";
    $email_content .= "-------------------------------------------\n";
    $email_content .= "$clean_msg\n";
    $email_content .= "-------------------------------------------\n";

    $sender_host = $_SERVER['HTTP_HOST'] ?? 'layerspy.de';
    $email_headers = "From: LayerSpy System <noreply@$sender_host>\r\n";
    $email_headers .= "Reply-To: $clean_name <$email>\r\n";
    $email_headers .= "MIME-Version: 1.0\r\n";
    $email_headers .= "Content-Type: text/plain; charset=UTF-8\r\n";
    $email_headers .= "X-Mailer: LayerSpy Secure Mailer\r\n";

    if (@mail($recipient, $subject, $email_content, $email_headers)) {
        http_response_code(200);
        echo json_encode(["status" => "success", "message" => "Ihre Nachricht wurde erfolgreich gesendet!"]);
    } else {
        http_response_code(500);
        echo json_encode(["status" => "error", "message" => "Der Server konnte die E-Mail nicht senden. Bitte versuchen Sie es später erneut."]);
    }
} elseif ($_SERVER["REQUEST_METHOD"] === "GET" && isset($_GET['action']) && $_GET['action'] === 'captcha') {
    // Dynamische Erzeugung einer Rechenaufgabe
    $num1 = rand(2, 9);
    $num2 = rand(1, 9);
    $token = bin2hex(random_bytes(16));
    
    $_SESSION['math_captcha'][$token] = $num1 + $num2;

    echo json_encode([
        "question" => "$num1 + $num2",
        "token" => $token,
        "time" => time()
    ]);
} else {
    http_response_code(403);
    echo json_encode(["status" => "error", "message" => "Ungültige Anfrage."]);
}
