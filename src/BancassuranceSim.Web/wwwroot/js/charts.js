// مدیریت نمودارهای سامانه شبیه‌ساز مالی با Chart.js

let breakevenChartInstance = null;
let inflationChartInstance = null;
let amortizationChartInstance = null;
let stakeholderPnlChartInstance = null;

// فرمت‌بندی اعداد به ریال / تومان و درصد
function formatCurrency(val) {
    if (val === undefined || val === null) return '۰';
    return Number(Math.round(val)).toLocaleString('fa-IR') + ' تومان';
}

function formatNumber(val, decimals = null) {
    if (val === undefined || val === null || isNaN(val)) return '۰';
    const num = Number(val);
    if (decimals !== null) {
        return num.toLocaleString('fa-IR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
    }
    if (Number.isInteger(num)) {
        return num.toLocaleString('fa-IR');
    }
    return Number(num.toFixed(1)).toLocaleString('fa-IR');
}

function formatPercent(val) {
    if (val === undefined || val === null || isNaN(val)) return '۰٪';
    return Number(val.toFixed(1)).toLocaleString('fa-IR') + '٪';
}

function initOrUpdateCharts(data) {
    if (typeof Chart === 'undefined') {
        console.warn('کتابخانه Chart.js بارگذاری نشده است؛ نمودارها موقتاً غیرفعال هستند.');
        return;
    }
    try {
        if (document.getElementById('breakevenChartCanvas')) updateBreakevenChart(data);
        if (document.getElementById('inflationChartCanvas')) updateInflationChart(data);
        if (document.getElementById('amortizationChartCanvas')) updateAmortizationChart(data);
        if (document.getElementById('stakeholderChartCanvas')) updateStakeholderChart(data);
    } catch (err) {
        console.error('خطا در رسم نمودارها:', err);
    }
}

// ۱. نمودار تحلیل نقطه سربه‌سر و رشد اندوخته
function updateBreakevenChart(data) {
    const ctx = document.getElementById('breakevenChartCanvas').getContext('2d');
    
    // نمونه‌برداری از ماه‌ها (برای روان‌تر شدن نمودار ماه به ماه یا هر ۳ ماه)
    const schedule = data.monthlySchedule;
    const labels = schedule.map(s => `ماه ${s.month}`);
    const fundValues = schedule.map(s => s.fundValueEnding);
    const netEquities = schedule.map(s => s.netSurrenderValue);
    const cumulativeOutflows = schedule.map(s => s.cumulativeCustomerOutflow);
    const remainingLoans = schedule.map(s => s.remainingLoanBalance);

    if (breakevenChartInstance) {
        breakevenChartInstance.destroy();
    }

    breakevenChartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'ارزش کل صندوق (ناخالص)',
                    data: fundValues,
                    borderColor: '#3b82f6',
                    backgroundColor: 'rgba(59, 130, 246, 0.05)',
                    borderWidth: 2,
                    fill: false,
                    tension: 0.2,
                    pointRadius: 0
                },
                {
                    label: 'ارزش بازخرید خالص بیمه‌گذار (اندوخته - مانده وام)',
                    data: netEquities,
                    borderColor: '#10b981',
                    backgroundColor: 'rgba(16, 185, 129, 0.12)',
                    borderWidth: 3,
                    fill: true,
                    tension: 0.2,
                    pointRadius: 0
                },
                {
                    label: 'مجموع پرداختی بیمه‌گذار (نقدی + اقساط)',
                    data: cumulativeOutflows,
                    borderColor: '#ef4444',
                    borderDash: [5, 5],
                    borderWidth: 2,
                    fill: false,
                    tension: 0,
                    pointRadius: 0
                },
                {
                    label: 'مانده بدهی وام به بانک',
                    data: remainingLoans,
                    borderColor: '#64748b',
                    borderWidth: 1.5,
                    borderDash: [2, 2],
                    fill: false,
                    tension: 0.1,
                    pointRadius: 0
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
                mode: 'index',
                intersect: false
            },
            plugins: {
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return `${context.dataset.label}: ${formatCurrency(context.parsed.y)}`;
                        }
                    }
                },
                legend: {
                    position: 'bottom',
                    labels: { font: { family: 'Vazirmatn', size: 11 } }
                }
            },
            scales: {
                x: {
                    ticks: {
                        font: { family: 'Vazirmatn', size: 10 },
                        maxTicksLimit: 12
                    }
                },
                y: {
                    ticks: {
                        font: { family: 'Vazirmatn', size: 10 },
                        callback: function(val) { return formatNumber(val / 1000000) + ' م'; }
                    }
                }
            }
        }
    });
}

// ۲. نمودار مقایسه ارزش اسمی و قدرت خرید واقعی با تورم
function updateInflationChart(data) {
    const ctx = document.getElementById('inflationChartCanvas').getContext('2d');
    const schedule = data.monthlySchedule;
    
    const labels = schedule.map(s => `ماه ${s.month}`);
    const nominalEquities = schedule.map(s => s.netSurrenderValue);
    const realEquities = schedule.map(s => s.netSurrenderValueReal);
    const realOutflows = schedule.map(s => s.cumulativeCustomerOutflowReal);

    if (inflationChartInstance) {
        inflationChartInstance.destroy();
    }

    inflationChartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'ارزش اسمی اندوخته خالص',
                    data: nominalEquities,
                    borderColor: '#2563eb',
                    borderWidth: 2.5,
                    fill: false,
                    tension: 0.2,
                    pointRadius: 0
                },
                {
                    label: 'قدرت خرید واقعی (تنزیل با تورم)',
                    data: realEquities,
                    borderColor: '#f59e0b',
                    backgroundColor: 'rgba(245, 158, 11, 0.15)',
                    borderWidth: 2.5,
                    fill: true,
                    tension: 0.2,
                    pointRadius: 0
                },
                {
                    label: 'پرداختی واقعی تنزیل‌شده مشتری',
                    data: realOutflows,
                    borderColor: '#dc2626',
                    borderDash: [4, 4],
                    borderWidth: 2,
                    fill: false,
                    pointRadius: 0
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
                mode: 'index',
                intersect: false
            },
            plugins: {
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return `${context.dataset.label}: ${formatCurrency(context.parsed.y)}`;
                        }
                    }
                },
                legend: {
                    position: 'bottom',
                    labels: { font: { family: 'Vazirmatn', size: 11 } }
                }
            },
            scales: {
                x: {
                    ticks: {
                        font: { family: 'Vazirmatn', size: 10 },
                        maxTicksLimit: 12
                    }
                },
                y: {
                    ticks: {
                        font: { family: 'Vazirmatn', size: 10 },
                        callback: function(val) { return formatNumber(val / 1000000) + ' م'; }
                    }
                }
            }
        }
    });
}

// ۳. نمودار استهلاک وام بانکی و وثیقه‌گذاری
function updateAmortizationChart(data) {
    const ctx = document.getElementById('amortizationChartCanvas').getContext('2d');
    
    // فقط ماه‌های دوره وام
    const loanMonths = data.monthlySchedule.filter(s => s.monthlyInstallment > 0 || s.month <= 24);
    const labels = loanMonths.map(s => `ماه ${s.month}`);
    const principalPaid = loanMonths.map(s => s.monthlyPrincipalPaid);
    const interestPaid = loanMonths.map(s => s.monthlyInterestPaid);
    const fundCover = loanMonths.map(s => s.fundValueEnding);

    if (amortizationChartInstance) {
        amortizationChartInstance.destroy();
    }

    amortizationChartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'سود ماهانه بانک',
                    data: interestPaid,
                    backgroundColor: '#0284c7',
                    stack: 'installments'
                },
                {
                    label: 'اصل وام ماهانه',
                    data: principalPaid,
                    backgroundColor: '#38bdf8',
                    stack: 'installments'
                },
                {
                    type: 'line',
                    label: 'ارزش وثیقه صندوق',
                    data: fundCover,
                    borderColor: '#10b981',
                    borderWidth: 2,
                    fill: false,
                    pointRadius: 0,
                    yAxisID: 'y1'
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return `${context.dataset.label}: ${formatCurrency(context.parsed.y)}`;
                        }
                    }
                },
                legend: {
                    position: 'bottom',
                    labels: { font: { family: 'Vazirmatn', size: 11 } }
                }
            },
            scales: {
                x: {
                    stacked: true,
                    ticks: { font: { family: 'Vazirmatn', size: 10 }, maxTicksLimit: 12 }
                },
                y: {
                    stacked: true,
                    position: 'right',
                    ticks: {
                        font: { family: 'Vazirmatn', size: 10 },
                        callback: function(val) { return formatNumber(val / 1000000) + ' م'; }
                    },
                    title: { display: true, text: 'قسط ماهانه', font: { family: 'Vazirmatn' } }
                },
                y1: {
                    position: 'left',
                    grid: { drawOnChartArea: false },
                    ticks: {
                        font: { family: 'Vazirmatn', size: 10 },
                        callback: function(val) { return formatNumber(val / 1000000) + ' م'; }
                    },
                    title: { display: true, text: 'ارزش صندوق وثیقه', font: { family: 'Vazirmatn' } }
                }
            }
        }
    });
}

// ۴. نمودار سود و زیان (P&L) سه ذی‌نفع
function updateStakeholderChart(data) {
    const ctx = document.getElementById('stakeholderChartCanvas').getContext('2d');
    
    // مقایسه در سال‌های ۱ تا N
    const years = data.yearlySummaries.map(y => `سال ${y.year}`);
    const customerGains = data.yearlySummaries.map(y => y.customerProfitNominal);
    const bankGains = data.yearlySummaries.map(y => {
        // سود تجمیعی بانک تا این سال
        const maxM = y.year * 12;
        const totalInterest = data.monthlySchedule.filter(s => s.month <= maxM).reduce((sum, s) => sum + s.monthlyInterestPaid, 0);
        return totalInterest + data.bankFeeAmount;
    });
    const insuranceGains = data.yearlySummaries.map(y => {
        // حاشیه تقریبی بیمه تا سال y
        return data.insuranceUnderwritingFeeAmount + (y.year * 250000);
    });

    if (stakeholderPnlChartInstance) {
        stakeholderPnlChartInstance.destroy();
    }

    stakeholderPnlChartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: years,
            datasets: [
                {
                    label: 'سود خالص بیمه‌گذار',
                    data: customerGains,
                    backgroundColor: '#10b981',
                    borderRadius: 4
                },
                {
                    label: 'عایدی ناخالص بانک',
                    data: bankGains,
                    backgroundColor: '#0284c7',
                    borderRadius: 4
                },
                {
                    label: 'سود خالص شرکت بیمه',
                    data: insuranceGains,
                    backgroundColor: '#7c3aed',
                    borderRadius: 4
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return `${context.dataset.label}: ${formatCurrency(context.parsed.y)}`;
                        }
                    }
                },
                legend: {
                    position: 'bottom',
                    labels: { font: { family: 'Vazirmatn', size: 11 } }
                }
            },
            scales: {
                x: {
                    ticks: { font: { family: 'Vazirmatn', size: 11 } }
                },
                y: {
                    ticks: {
                        font: { family: 'Vazirmatn', size: 10 },
                        callback: function(val) { return formatNumber(val / 1000000) + ' م'; }
                    }
                }
            }
        }
    });
}
