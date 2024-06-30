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
        </span>
        <div id="result" style="display:none;">
            <h3>Results:</h3>
            <canvas id="result-chart"></canvas>
            <h3>Hash:</h3>
            <span id="result-hash"></span>
        </div>
    </div>
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/crypto-js@4.1.1/crypto-js.js"></script>
    <script src="/assets/js/motivation-test.js"></script>
</body>
