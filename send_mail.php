<?php
// send_mail.php
header('Content-Type: application/json');

if ($_SERVER["REQUEST_METHOD"] == "POST") {
    // Eingabedaten sicher sammeln
    $name = strip_tags(trim($_POST["name"] ?? ''));
    $email = filter_var(trim($_POST["email"] ?? ''), FILTER_SANITIZE_EMAIL);
    $message = trim($_POST["message"] ?? '');
    $honeypot = trim($_POST["website_url"] ?? ''); // Unsichtbares Spam-Feld

    // Honeypot Spam-Check (Wenn das Feld ausgefüllt ist, ist es ein Bot)
    if (!empty($honeypot)) {
        http_response_code(200);
        echo json_encode(["status" => "success", "message" => "Nachricht gesendet."]);
        exit;
    }

    // Validierung
    if (empty($name) || empty($message) || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
        http_response_code(400);
        echo json_encode(["status" => "error", "message" => "Bitte füllen Sie alle Felder korrekt aus."]);
        exit;
    }

    // E-Mail Einstellungen
    $recipient = "info@layerspy.de"; // <--- HIER DEINE ECHTE E-MAIL EINTRAGEN
    $subject = "Neue Kontaktanfrage (LayerSpy) von $name";
    
    $email_content = "Name: $name\n";
    $email_content .= "E-Mail: $email\n\n";
    $email_content .= "Nachricht:\n$message\n";

    // E-Mail Header
    $email_headers = "From: LayerSpy Kontaktformular <noreply@" . $_SERVER['HTTP_HOST'] . ">\r\n";
    $email_headers .= "Reply-To: $name <$email>\r\n";
    $email_headers .= "X-Mailer: PHP/" . phpversion();

    // E-Mail senden
    if (mail($recipient, $subject, $email_content, $email_headers)) {
        http_response_code(200);
        echo json_encode(["status" => "success", "message" => "Ihre Nachricht wurde erfolgreich gesendet!"]);
    } else {
        http_response_code(500);
        echo json_encode(["status" => "error", "message" => "Oops! Der Server konnte die E-Mail nicht senden. Bitte überprüfen Sie die PHP-Mail-Konfiguration."]);
    }
} else {
    http_response_code(403);
    echo json_encode(["status" => "error", "message" => "Nur POST-Anfragen sind erlaubt."]);
}
?>
