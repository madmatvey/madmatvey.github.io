---
# the default layout is 'page'
title: Proof of Motivation
description: Uncover what drives you with our Motivation Test DApp. Reveal your key motivators and gain insights into your growth. Start now!
icon: fas fa-sun
order: 5
image:
    path: assets/img/motivation-test.png
---
<head>
    <link rel="stylesheet" href="/assets/css/motivation-test-page.css" type="text/css">
</head>
<body>
    <div id="container">
        <h3>Discover Your Core Motivation - Take the Motivation Test DApp Today!</h3>
        <div id="results" style="display:none;">
            <h3>Results:</h3>
        </div>
        <div id="web3actions">
            <button id="connectWalletBtn" class="web3button">Login With Metamask</button>
            <input id="paymentAmount" type="number" step="0.0005" min="0.003" placeholder="Enter payment amount in ETH" value="0.003"> ETH (0.003 ETH minimum contribution for recording test results in a blockchain)
            <button id="writeResultBtn" class="web3button">Save Test Result</button>
            <button id="withdrawFunds" class="web3button" style="display:none;">Withdraw Funds</button>
        </div>
        <span id="questions-part">
            <div class="label-container">
                <p id="category"></p>
            </div>
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
            <h3>Result:</h3>
            <span id="result-text"></span>
            <h3>Chart:</h3>
            <canvas id="result-chart"></canvas>
            <h3>Hash:</h3>
            <span id="result-hash"></span>
        </div>
    </div>
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/crypto-js@4.1.1/crypto-js.js"></script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/ethers/6.13.1/ethers.umd.min.js" type="application/javascript"></script>
    <script src="/assets/js/motivation-test.js" type="module"></script>
</body>
