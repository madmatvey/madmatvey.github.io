"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
let currentCategoryIndex = 0;
let currentQuestionIndex = 0;
let answers = {};
let categories = [];
const secretKey = 'dont give up, keep trying, try it from the other side.';
document.addEventListener('DOMContentLoaded', () => __awaiter(void 0, void 0, void 0, function* () {
    const questionElement = document.getElementById('question');
    const categoryElement = document.getElementById('category');
    const circlesContainer = document.getElementById('circles-container');
    let testData = yield fetchTestData();
    categories = Object.keys(testData).filter(key => key !== 'language');
    categories.forEach(category => answers[category] = []);
    const lowLabel = document.getElementById('low');
    const highLabel = document.getElementById('high');
    const nextBtn = document.getElementById('nextBtn');
    const urlParams = new URLSearchParams(window.location.search);
    let encryptedResult = urlParams.get('result');
    if (encryptedResult) {
        try {
            const decryptedData = JSON.parse(decrypt(encryptedResult));
            answers = decryptedData;
            showResult();
            return;
        }
        catch (error) {
            console.error('Failed to decrypt data:', error);
            startTest();
        }
    }
    else {
        startTest();
    }
    nextBtn.addEventListener('click', () => {
        const currentCategory = categories[currentCategoryIndex];
        answers[currentCategory].push(parseInt(circlesContainer.dataset.selected || "0"));
        currentQuestionIndex++;
        if (currentQuestionIndex < testData[currentCategory].length) {
            showQuestion(testData, currentCategory, currentQuestionIndex);
        }
        else {
            currentQuestionIndex = 0;
            currentCategoryIndex++;
            if (currentCategoryIndex < categories.length) {
                showQuestion(testData, categories[currentCategoryIndex], currentQuestionIndex);
            }
            else {
                submitResults();
            }
        }
    });
    function fetchTestData() {
        return __awaiter(this, void 0, void 0, function* () {
            return fetch(`/assets/js/data/motivation-test/motivation-test-questions-en.json`)
                .then(response => response.json())
                .then(data => {
                let result = data[0];
                return result;
            });
        });
    }
    function startTest() {
        showQuestion(testData, categories[currentCategoryIndex], currentQuestionIndex);
    }
    function showQuestion(testData, category, index) {
        const selected_question = testData[category][index];
        categoryElement.textContent = capitalizeFirstLetter(category);
        questionElement.textContent = selected_question.question;
        lowLabel.textContent = selected_question.low;
        highLabel.textContent = selected_question.high;
        circlesContainer.innerHTML = '';
        for (let i = 1; i <= 7; i++) {
            const circle = document.createElement('div');
            circle.className = 'answer-circle';
            let raduis = (i <= 4) ? 50 - i * 5 : 10 + i * 5;
            circle.style.width = `${raduis}px`;
            circle.style.height = `${raduis}px`;
            circle.style.backgroundColor = getColor(i);
            circle.dataset.value = i.toString();
            circle.addEventListener('click', () => selectAnswer(i));
            circlesContainer.appendChild(circle);
        }
    }
    function showResult() {
        const resultDiv = document.getElementById('result');
        const questionsSpan = document.getElementById('questions-part');
        const resultText = document.getElementById('result-text');
        resultDiv.style.display = 'block';
        questionsSpan.style.display = 'none';
        const scores = {};
        let htmlTextResutls = '';
        categories.forEach(category => {
            const categoryAnswers = answers[category];
            const average = categoryAnswers.reduce((acc, curr) => acc + curr, 0) / categoryAnswers.length;
            scores[category] = Number((Math.round(average * 100) / 100).toFixed(2));
        });
        const categoriesSortedByResult = Object.keys(scores).sort(function (a, b) { return scores[b] - scores[a]; });
        categoriesSortedByResult.forEach((category) => {
            htmlTextResutls += `
            <span class="text-result top-${8 - Math.round(scores[category])}">
                ${capitalizeFirstLetter(category)}: ${Number(Math.round(100 * scores[category]) / 7).toFixed(0)}%
            </span>`;
        });
        resultText.innerHTML = htmlTextResutls;
        renderChart(scores);
        const hashSpan = document.getElementById('result-hash');
        if (encryptedResult) {
            hashSpan.innerHTML = encryptedResult;
        }
        localStorage.setItem('motivationTestResult', JSON.stringify(answers));
    }
    function selectAnswer(value) {
        const circles = document.querySelectorAll('.answer-circle');
        circles.forEach(circle => {
            if (parseInt(circle.dataset.value || "0") === value) {
                circle.style.border = '2px solid black';
                circlesContainer.dataset.selected = value.toString();
            }
            else {
                circle.style.border = 'none';
            }
        });
        nextBtn.click();
    }
    function getColor(value) {
        const red = 255 - (value - 1) * 28;
        const green = (value - 1) * 28;
        return `rgb(${red}, ${green}, 0, 0.5)`;
    }
    function capitalizeFirstLetter(string) {
        return string.charAt(0).toUpperCase() + string.slice(1).toLowerCase();
    }
    function submitResults() {
        localStorage.setItem('motivationTestResult', JSON.stringify(answers));
        encryptedResult = encrypt(JSON.stringify(answers));
        const newUrl = `${window.location.pathname}?result=${encryptedResult}`;
        window.history.replaceState({}, '', newUrl);
        showResult();
    }
    function encrypt(plainText) {
        var b64 = CryptoJS.AES.encrypt(plainText, secretKey).toString();
        var e64 = CryptoJS.enc.Base64.parse(b64);
        var eHex = e64.toString(CryptoJS.enc.Hex);
        return eHex;
    }
    function decrypt(cipherText) {
        var reb64 = CryptoJS.enc.Hex.parse(cipherText);
        var bytes = reb64.toString(CryptoJS.enc.Base64);
        var decrypt = CryptoJS.AES.decrypt(bytes, secretKey);
        var plain = decrypt.toString(CryptoJS.enc.Utf8);
        return plain;
    }
    function renderChart(scores) {
        const ctx = document.getElementById('result-chart');
        new Chart(ctx, {
            type: 'radar',
            data: {
                labels: Object.keys(scores),
                datasets: [{
                        label: 'Motivation Scores',
                        data: Object.values(scores),
                        backgroundColor: 'rgba(54, 162, 235, 0.2)',
                        borderColor: 'rgba(54, 162, 235, 1)',
                        borderWidth: 1
                    }]
            },
            options: {
                scales: {
                    r: {
                        grid: {
                            circular: true,
                            color: "#003366",
                            // drawTicks: false
                        },
                        max: 7,
                        min: 0,
                        ticks: {
                            display: false
                        },
                    }
                }
            }
        });
    }
}));
