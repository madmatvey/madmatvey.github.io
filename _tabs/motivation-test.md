---
# the default layout is 'page'
icon: fas fa-sun
order: 5
---
<head>
    <style>
        body {
            font-family: Arial, sans-serif;
            padding: 20px;
        }
        .motivation-container {
            margin-bottom: 20px;
        }
        .motivation-container label {
            display: block;
            margin-bottom: 5px;
        }
        .motivation-container input {
            width: 80%;
        }
        .result {
            margin-top: 20px;
        }
    </style>
</head>
<body>
    <p>Rate each parameter from 1 to 10 based on your motivation:</p>
    <div class="motivation-container">
        <p id="question"></p>
        <input type="range" id="slider" min="1" max="10" value="1">
    </div>
    <button id="nextBtn">Next</button>
    <div class="result" id="result"></div>
    <button id="submitBtn">Submit</button>
    <div class="result" id="result">
        <canvas id="radarChart" width="400" height="400"></canvas>
    </div>
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
    <script src="/assets/js/motivation-test.js"></script>
</body>
</html>
