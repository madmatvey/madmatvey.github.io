// import { Chart } from 'chart.js/auto';
export function renderChart(scores) {
    const ctx = document.getElementById('result-chart');
    const existingChart = Chart.getChart(ctx);
    if (existingChart) {
        existingChart.destroy();
    }
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
                    },
                    max: 100,
                    min: 0,
                    ticks: {
                        display: false
                    },
                }
            }
        }
    });
}
