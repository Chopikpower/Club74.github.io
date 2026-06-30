<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');

$file = 'tournament.json';

// Создаем файл если не существует
if (!file_exists($file)) {
    $default = [
        'currentLevel' => 1,
        'timeRemaining' => 720,
        'elapsedTime' => 0,
        'smallBlind' => 100,
        'bigBlind' => 200,
        'ante' => 0,
        'levelDuration' => 12,
        'players' => [],
        'timestamp' => time()
    ];
    file_put_contents($file, json_encode($default, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
}

$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    // Получить данные
    echo file_get_contents($file);
} 
elseif ($method === 'POST') {
    // Сохранить данные
    $input = file_get_contents('php://input');
    $data = json_decode($input, true);
    
    if ($data) {
        $data['timestamp'] = time();
        file_put_contents($file, json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
        echo json_encode(['status' => 'success']);
    } else {
        http_response_code(400);
        echo json_encode(['status' => 'error', 'message' => 'Invalid data']);
    }
}
?>