"use strict";
// document.addEventListener('DOMContentLoaded', () => {
//     const parameters = [
//         'Curiosity', 'Honor', 'Acceptance', 'Mastery', 'Power',
//         'Freedom', 'Relatedness', 'Order', 'Goal', 'Status'
//     ];
let currentCategoryIndex = 0;
let currentQuestionIndex = 0;
let answers = {};
let categories = [];
document.addEventListener('DOMContentLoaded', () => {
    const questionElement = document.getElementById('question');
    const categoryElement = document.getElementById('category');
    const circlesContainer = document.getElementById('circles-container');
    const lowLabel = document.getElementById('low');
    const highLabel = document.getElementById('high');
    const nextBtn = document.getElementById('nextBtn');
    fetch('/assets/js/data/motivation-test.json')
        .then(response => response.json())
        .then(data => {
        const testData = data[0];
        categories = Object.keys(testData).filter(key => key !== 'language');
        categories.forEach(category => answers[category] = []);
        showQuestion(testData, categories[currentCategoryIndex], currentQuestionIndex);
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
                    showResult();
                }
            }
        });
    });
    function showQuestion(testData, category, index) {
        const selected_question = testData[category][index];
        categoryElement.textContent = category;
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
        resultDiv.innerHTML = '<h2>Results:</h2><canvas id="result-chart"></canvas>';
        const scores = {};
        categories.forEach(category => {
            const categoryAnswers = answers[category];
            const average = categoryAnswers.reduce((acc, curr) => acc + curr, 0) / categoryAnswers.length;
            scores[category] = average;
        });
        renderChart(scores);
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
                        beginAtZero: true,
                        max: 9
                    }
                }
            }
        });
    }
    // function drawRadarChart(values: number[]) {
    //     const data = {
    //         labels: parameters,
    //         datasets: [{
    //             label: 'Motivation Level',
    //             data: values,
    //             backgroundColor: 'rgba(255, 99, 132, 0.2)',
    //             borderColor: 'rgba(255, 99, 132, 1)',
    //             borderWidth: 1
    //         }]
    //     };
    //     const options = {
    //         scale: {
    //             ticks: { beginAtZero: true, max: 10 },
    //             pointLabels: { fontSize: 14 }
    //         }
    //     };
    //     if (ctx != null) {
    //         new Chart(ctx, {
    //             type: 'radar',
    //             data: data,
    //             options: options
    //         });
    //     }
    // }
    /**
     * Recursively collects all values from an object.
     * @param obj - The object to collect values from.
     * @returns An array of values.
     */
    function getAllValues(obj) {
        let values = [];
        for (const key in obj) {
            if (obj.hasOwnProperty(key)) {
                const value = obj[key];
                if (typeof value === 'object' && !Array.isArray(value)) {
                    values = values.concat(getAllValues(value));
                }
                else {
                    values.push(value);
                }
            }
        }
        return values;
    }
});
