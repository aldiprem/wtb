<?php
// proxy-ip.php - CORS proxy untuk IP2Location API
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET');
header('Access-Control-Allow-Headers: Content-Type');

$api_key = '6EB4A091A2076236C36962F2FB51E969';
$url = "https://api.ip2location.io/?key={$api_key}&format=json&security=true";

$ch = curl_init();
curl_setopt($ch, CURLOPT_URL, $url);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
curl_setopt($ch, CURLOPT_TIMEOUT, 10);

$response = curl_exec($ch);
$http_code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);

if ($http_code === 200 && $response) {
    echo $response;
} else {
    echo json_encode(['error' => 'Gagal mengambil data', 'http_code' => $http_code]);
}
?>