---
# the default layout is 'page'
title: Discover Your Core Motivation
description: Uncover what drives you with our Motivation Test. Reveal your key motivators and gain insights into your growth. Start now!
icon: fas fa-sun
order: 5
image:
    path: assets/img/motivation-test.png
---

<link rel="stylesheet" href="/assets/css/motivation-test.css">

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
        <h2>Results:</h2>
        <span id="result-text"></span>
        <h2>Chart:</h2>
        <canvas id="result-chart"></canvas>
        <h2>Hash:</h2>
        <span id="result-hash"></span>
    </div>
</div>
<script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
<script src="https://cdn.jsdelivr.net/npm/crypto-js@4.1.1/crypto-js.js"></script>
<script src="/assets/js/motivation-test.js"></script>
