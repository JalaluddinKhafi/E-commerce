<?php
// Legacy template endpoint. The React application uses the Spring Boot API.
header('Content-Type: text/plain; charset=utf-8');

function reject($status, $message) {
    http_response_code($status);
    echo $message;
    exit;
}

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    header('Allow: POST');
    reject(405, 'Only POST requests are accepted.');
}

$fields = [];
foreach (['name' => 100, 'email' => 254, 'subject' => 200, 'message' => 5000] as $field => $limit) {
    $value = $_POST[$field] ?? '';
    if (!is_string($value) || trim($value) === '' || strlen($value) > $limit) {
        reject(400, 'Please provide a valid ' . $field . '.');
    }
    $fields[$field] = trim($value);
}
if (!filter_var($fields['email'], FILTER_VALIDATE_EMAIL) || preg_match('/[\r\n]/', $fields['email'])) {
    reject(400, 'Please provide a valid email address.');
}

$recipient = getenv('CONTACT_TO_EMAIL');
$sender = getenv('CONTACT_FROM_EMAIL');
foreach ([$recipient, $sender] as $configuredEmail) {
    if (!$configuredEmail || !filter_var($configuredEmail, FILTER_VALIDATE_EMAIL) || preg_match('/[\r\n]/', $configuredEmail)) {
        reject(503, 'Contact email is not configured. Please contact the store directly.');
    }
}
$body = "Name: " . $fields['name'] . "\nEmail: " . $fields['email'] .
    "\nSubject: " . $fields['subject'] . "\n\n" . $fields['message'];
$headers = "From: " . $sender . "\r\nReply-To: " . $fields['email'] .
    "\r\nContent-Type: text/plain; charset=UTF-8";
if (!mail($recipient, 'New store contact message', $body, $headers)) {
    reject(502, 'Message could not be sent. Please try again later.');
}
echo 'success';
