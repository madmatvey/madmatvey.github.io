---
# the default layout is 'page'
titile: Discover Your Core Motivation - Take the Motivation Test Today!
description: Uncover what drives you with our Motivation Test. Reveal your key motivators and gain insights into your growth. Start now!
icon: fas fa-sun
order: 5
image:
    path: assets/img/motivation-test.png
---
<head>
    <style>
        body {
            font-family: Arial, sans-serif;
            padding: 20px;
        }
        #question {
            font-size: 1.2em;
            margin-bottom: 20px;
        }
        .label-container {
            display: flex;
            flex-wrap: wrap;
            justify-content: space-between;
            align-items: center;
            align-content: center;
            margin-bottom: 20px;
        }
        #low {
            width: 20%;
            order: 1;
            text-align: left;
        }
        #high {
            width: 20%;
            order: 3;
            text-align: right;
        }
        #circles-container {
            display: flex;
            align-items: center;
            justify-content: space-between;
            flex-wrap: nowrap;
            width: 60%;
            order: 2;
        }
        .answer-circle {
            display: inline-block;
            margin: 0 5px;
            border-radius: 50%;
            cursor: pointer;
            flex-shrink: 0;
        }
        .answer-circle:hover {
            opacity: 0.5;
        }
        #result {
            margin-top: 20px;
        }
        #result-hash {
            font-family: monospace;
            background:var(--background-color);
            padding: 5px;
            border-radius: 3px;
            display: inline-block;
            word-break: break-all;
            word-wrap: break-word;
        }
        .text-result {
            margin: 0.5em;
            display: inline-block;
        }
        .top-1 {
            font-size: 2.5em;
            color: rgba(255, 255, 255, 1.0); /* Полная насыщенность */
            font-weight: bold;
        }
        .top-2 {
            font-size: 2.3em;
            color: rgba(255, 255, 255, 0.9); /* 90% насыщенности */
            font-weight: bold;
        }
        .top-3 {
            font-size: 2.1em;
            color: rgba(255, 255, 255, 0.8); /* 80% насыщенности */
            font-weight: bold;
        }
        .top-4 {
            font-size: 1.9em;
            color: rgba(255, 255, 255, 0.7); /* 70% насыщенности */
            font-weight: bold;
        }
        .top-5 {
            font-size: 1.7em;
            color: rgba(255, 255, 255, 0.6); /* 60% насыщенности */
            font-weight: bold;
        }
        .top-6 {
            font-size: 1.5em;
            color: rgba(255, 255, 255, 0.5); /* 50% насыщенности */
            font-weight: normal;
        }
        .top-7 {
            font-size: 1.3em;
            color: rgba(255, 255, 255, 0.4); /* 40% насыщенности */
            font-weight: normal;
        }
        #progress-container {
            width: 100%;
            background-color: #f3f3f39c;
            border-radius: 30px;
            margin-top: 37px;
        }
        #progress-bar {
            width: 0%;
            height: 15px;
            background-color: #198754;
            border-radius: 25px;
        }
        #progress-text {
            text-align: center;
            margin-top: 10px;
        }
        @media (max-width: 768px) {
            .label-container {
                flex-direction: raw;
            }
            #low {
                order: 2;
                width: 40%;
                margin-top: 15px;
            }
            #circles-container {
                order: 1;
                width: 100%;
            }
            #high {
                order: 3;
                width: 40%;
                margin-top: 15px;
            }
        }   
    </style>
</head>
<body>
    <div id="container">
        <span id="questions-part">
            <p id="category"></p>
            <p id="question"></p>
            <div class="label-container">
                <div id="circles-container"></div>
                <div id="low"></div>
                <div id="high"></div>
            </div>
            <button id="nextBtn" style="display:none;">Next</button>
            <div id="progress-container">
                <div id="progress-bar"></div>
            </div>
            <p id="progress-text"></p>
        </span>
        <div id="result" style="display:none;">
            <h3>Results:</h3>
            <span id="result-text"></span>
            <h3>Chart:</h3>
            <canvas id="result-chart"></canvas>
            <h3>Hash:</h3>
            <span id="result-hash"></span>
        </div>
    </div>
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/crypto-js@4.1.1/crypto-js.js"></script>
    <script src="/assets/js/motivation-test.js"></script>
</body>
