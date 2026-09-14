// لاجیک اصلی سامانه شبیه‌ساز مالی، ارتباط با API، به‌روزرسانی کارت‌ها و جداول

let currentData = null;
let debounceTimer = null;

// تنظیمات پیش‌فرض
const currentModel = {
    totalPolicyValue: 100000000,
    customerInitialCash: 40000000,
    bankLoanAmount: 60000000,
    bankFeeRate: 0.065,
    bankBlockedDepositRate: 0.04,
    bankBlockedDepositDurationMonths: 12,
    bankLoanAnnualInterestRate: 0.23,
    bankLoanTenureMonths: 24,
    deductBankChargesFromLoanProceeds: true,
    insuranceUnderwritingFeeRate: 0.05,
    lifeCoverageFeeRate: 0.05,
    lifeCoverageCapital: 100000000,
    agentCommissionRate: 0.02,
    agentCommissionFromCustomer: true,
    fundAnnualReturnRate: 0.30,
    annualInflationRate: 0.40,
    simulationYears: 10,
    insuredAge: 35
};

// راه‌اندازی اولیه
document.addEventListener('DOMContentLoaded', () => {
    initEventListeners();
    fetchSimulation();
});

function initEventListeners() {
    // اتصال اسلایدرها و فیلدهای عددی
    bindInputPair('totalPolicyValue', 'totalPolicyValueSlider', val => Number(val));
    bindInputPair('customerInitialCash', 'customerInitialCashSlider', val => Number(val));
    bindInputPair('bankLoanAmount', 'bankLoanAmountSlider', val => Number(val));
    bindInputPair('bankFeeRate', 'bankFeeRateSlider', val => Number(val) / 100);
    bindInputPair('bankBlockedDepositRate', 'bankBlockedDepositRateSlider', val => Number(val) / 100);
    bindInputPair('bankLoanAnnualInterestRate', 'bankLoanAnnualInterestRateSlider', val => Number(val) / 100);
    bindInputPair('bankLoanTenureMonths', 'bankLoanTenureMonthsSlider', val => parseInt(val));
    bindInputPair('insuranceUnderwritingFeeRate', 'insuranceUnderwritingFeeRateSlider', val => Number(val) / 100);
    bindInputPair('lifeCoverageFeeRate', 'lifeCoverageFeeRateSlider', val => Number(val) / 100);
    bindInputPair('lifeCoverageCapital', 'lifeCoverageCapitalSlider', val => Number(val));
    bindInputPair('agentCommissionRate', 'agentCommissionRateSlider', val => Number(val) / 100);
    bindInputPair('fundAnnualReturnRate', 'fundAnnualReturnRateSlider', val => Number(val) / 100);
    bindInputPair('annualInflationRate', 'annualInflationRateSlider', val => Number(val) / 100);
    bindInputPair('simulationYears', 'simulationYearsSlider', val => parseInt(val));
    bindInputPair('insuredAge', 'insuredAgeSlider', val => parseInt(val));

    // چک‌باکس‌ها
    const deductCb = document.getElementById('deductBankChargesFromLoanProceeds');
    if (deductCb) {
        deductCb.addEventListener('change', (e) => {
            currentModel.deductBankChargesFromLoanProceeds = e.target.checked;
            triggerRecalculate();
        });
    }

    const agentCb = document.getElementById('agentCommissionFromCustomer');
    if (agentCb) {
        agentCb.addEventListener('change', (e) => {
            currentModel.agentCommissionFromCustomer = e.target.checked;
            triggerRecalculate();
        });
    }

    // تب‌ها
    const tabBtns = document.querySelectorAll('.tab-btn');
    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            tabBtns.forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
            btn.classList.add('active');
            const target = btn.getAttribute('data-tab');
            document.getElementById(target).classList.add('active');
        });
    });

    // آکاردئون‌های سایدبار
    document.querySelectorAll('.accordion-header').forEach(header => {
        header.addEventListener('click', () => {
            const content = header.nextElementSibling;
            const icon = header.querySelector('.acc-icon');
            if (content.style.display === 'none') {
                content.style.display = 'flex';
                icon.textContent = '▼';
            } else {
                content.style.display = 'none';
                icon.textContent = '◀';
            }
        });
    });
}

function bindInputPair(propName, sliderId, parser) {
    const numInput = document.getElementById(propName);
    const slider = document.getElementById(sliderId);

    if (numInput && slider) {
        numInput.addEventListener('input', (e) => {
            slider.value = numInput.value;
            currentModel[propName] = parser(numInput.value);
            updateDisplayLabel(propName, numInput.value);
            triggerRecalculate();
        });

        slider.addEventListener('input', (e) => {
            numInput.value = slider.value;
            currentModel[propName] = parser(slider.value);
            updateDisplayLabel(propName, slider.value);
            triggerRecalculate();
        });
    }
}

function updateDisplayLabel(propName, value) {
    const displayEl = document.getElementById(`${propName}Val`);
    if (!displayEl) return;

    if (propName.includes('Rate')) {
        displayEl.textContent = Number(value).toLocaleString('fa-IR') + '٪';
    } else if (propName.includes('Amount') || propName.includes('Cash') || propName.includes('Value') || propName.includes('Capital')) {
        displayEl.textContent = (Number(value) / 1000000).toLocaleString('fa-IR') + ' م تومان';
    } else if (propName.includes('Months')) {
        displayEl.textContent = Number(value).toLocaleString('fa-IR') + ' ماه';
    } else if (propName.includes('Years')) {
        displayEl.textContent = Number(value).toLocaleString('fa-IR') + ' سال';
    } else if (propName.includes('Age')) {
        displayEl.textContent = Number(value).toLocaleString('fa-IR') + ' سال';
    }
}

function triggerRecalculate() {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
        fetchSimulation();
    }, 250);
}

async function fetchSimulation() {
    try {
        const response = await fetch('/api/simulation/calculate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(currentModel)
        });

        if (!response.ok) throw new Error('خطا در فراخوانی سرویس محاسبات');

        const data = await response.json();
        currentData = data;
        renderDashboard(data);
    } catch (err) {
        console.error(err);
    }
}

function renderDashboard(data) {
    renderKPIs(data);
    renderWaterfall(data);
    initOrUpdateCharts(data);
    renderInsuranceStrategicAnalysis(data.insuranceAnalysis);
    renderMortalityTable(data);
    renderYearlyTable(data);
    renderSensitivityTable(data);
    renderMonthlyTable(data);
}

function renderKPIs(data) {
    // کارت نقطه سربه‌سر
    const beEl = document.getElementById('kpiBreakevenVal');
    const beSub = document.getElementById('kpiBreakevenSub');
    if (data.nominalBreakevenMonth) {
        const yr = Math.floor((data.nominalBreakevenMonth - 1) / 12) + 1;
        const mo = ((data.nominalBreakevenMonth - 1) % 12) + 1;
        beEl.innerHTML = `<span style="color: #059669;">ماه ${formatNumber(data.nominalBreakevenMonth)}</span>`;
        beSub.innerHTML = `معادل <strong>سال ${formatNumber(yr)} و ماه ${formatNumber(mo)}</strong> | سربه‌سر با تورم: <strong>${data.realBreakevenMonth ? 'ماه ' + formatNumber(data.realBreakevenMonth) : 'نامشخص'}</strong>`;
    } else {
        beEl.innerHTML = `<span style="color: #dc2626;">بیش از ۱۰ سال</span>`;
        beSub.innerHTML = `در این بازه هزینه اقساط و کارمزدها جبران نمی‌شود.`;
    }

    // کارت بازده مشتری
    const irrEl = document.getElementById('kpiIrrVal');
    const irrSub = document.getElementById('kpiIrrSub');
    irrEl.textContent = formatPercent(data.customerAnnualIRR * 100);
    irrSub.innerHTML = `بازده واقعی پس از کسر تورم: <strong>${formatPercent(data.customerRealIRR * 100)}</strong>`;

    // کارت دارایی نهایی
    const fundEl = document.getElementById('kpiFundVal');
    const fundSub = document.getElementById('kpiFundSub');
    fundEl.textContent = formatCurrency(data.customerFinalNominalFund);
    fundSub.innerHTML = `کل پرداختی: <strong>${formatCurrency(data.customerTotalPayments)}</strong> (سود: ${formatCurrency(data.customerNominalGain)})`;

    // کارت بانک
    const bankEl = document.getElementById('kpiBankVal');
    const bankSub = document.getElementById('kpiBankSub');
    bankEl.textContent = formatPercent(data.bankEffectiveAPR * 100);
    bankSub.innerHTML = `کل عایدی ناخالص: <strong>${formatCurrency(data.stakeholders.bankTotalGrossRevenue)}</strong> | ریسک نکول: <strong>صفر</strong>`;

    // کارت بیمه
    const insEl = document.getElementById('kpiInsVal');
    const insSub = document.getElementById('kpiInsSub');
    insEl.textContent = formatCurrency(data.stakeholders.insuranceNetMargin);
    insSub.innerHTML = `درآمد بیمه‌گری: <strong>${formatCurrency(data.stakeholders.insuranceUnderwritingIncome)}</strong> | خسارت انتظاری: <strong>${formatCurrency(data.stakeholders.insuranceExpectedClaimExpense)}</strong>`;
}

function renderWaterfall(data) {
    document.getElementById('wfCustomerCash').textContent = formatCurrency(data.customerInitialCash);
    document.getElementById('wfBankLoan').textContent = formatCurrency(data.bankLoanAmount);
    document.getElementById('wfBankFee').textContent = '-' + formatCurrency(data.bankFeeAmount);
    document.getElementById('wfBankBlocked').textContent = '-' + formatCurrency(data.bankBlockedDepositAmount);
    document.getElementById('wfUnderwriting').textContent = '-' + formatCurrency(data.insuranceUnderwritingFeeAmount);
    document.getElementById('wfLifeCover').textContent = '-' + formatCurrency(data.lifeCoverageFeeAmount);
    document.getElementById('wfAgentFee').textContent = '-' + formatCurrency(data.agentCommissionAmount);
    document.getElementById('wfNetFund').textContent = formatCurrency(data.netInitialFundDeposit);

    // اقساط ماهانه
    document.getElementById('wfMonthlyInstallment').textContent = formatCurrency(data.monthlyInstallment);
    document.getElementById('wfTotalInstallments').textContent = formatCurrency(data.totalInstallmentsAmount);
    document.getElementById('wfTotalInterest').textContent = formatCurrency(data.totalLoanInterestAmount);
}

function renderMortalityTable(data) {
    const tbody = document.getElementById('mortalityTableBody');
    tbody.innerHTML = '';
    data.mortalityScenarios.forEach(s => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><strong>سال ${formatNumber(s.year)}</strong></td>
            <td>${formatCurrency(s.lifeInsuranceBenefit)}</td>
            <td>${formatCurrency(s.accumulatedFundValue)}</td>
            <td style="color: #dc2626;">${formatCurrency(s.remainingLoanToSettle)}</td>
            <td style="color: #059669; font-weight: 700;">${formatCurrency(s.netPayoutToFamily)}</td>
            <td>${formatCurrency(s.totalPremiumsAndInstallmentsPaid)}</td>
            <td><span class="tag-badge tag-primary">${formatNumber(s.netBenefitToFamilyRatio.toFixed(2))} برابر</span></td>
        `;
        tbody.appendChild(tr);
    });
}

function renderYearlyTable(data) {
    const tbody = document.getElementById('yearlyTableBody');
    tbody.innerHTML = '';
    data.yearlySummaries.forEach(y => {
        const tr = document.createElement('tr');
        if (y.isBreakevenNominal) tr.classList.add('breakeven-row');
        tr.innerHTML = `
            <td><strong>سال ${formatNumber(y.year)}</strong></td>
            <td>${formatCurrency(y.cumulativePaid)}</td>
            <td>${formatCurrency(y.fundValueNominal)}</td>
            <td>${formatCurrency(y.remainingLoan)}</td>
            <td style="font-weight: 700;">${formatCurrency(y.netEquityNominal)}</td>
            <td style="color: #b45309;">${formatCurrency(y.netEquityReal)}</td>
            <td style="color: ${y.customerProfitNominal >= 0 ? '#059669' : '#dc2626'};">${formatCurrency(y.customerProfitNominal)}</td>
            <td>${formatPercent(y.returnOnInvestmentNominalPct)}</td>
            <td>${y.isBreakevenNominal ? '<span class="tag-badge tag-success">سربه‌سر</span>' : '<span class="tag-badge tag-danger">دوره بازگشت</span>'}</td>
        `;
        tbody.appendChild(tr);
    });
}

function renderSensitivityTable(data) {
    const tbody = document.getElementById('sensitivityTableBody');
    tbody.innerHTML = '';
    data.sensitivityAnalysis.forEach(p => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><strong>${formatPercent(p.fundReturnRate * 100)}</strong></td>
            <td>${formatPercent(p.loanInterestRate * 100)}</td>
            <td>${formatPercent(p.inflationRate * 100)}</td>
            <td>${p.breakevenMonthNominal ? 'ماه ' + formatNumber(p.breakevenMonthNominal) : '<span style="color: #dc2626;">نامشخص</span>'}</td>
            <td>${formatCurrency(p.customer5YearProfitNominal)}</td>
            <td style="font-weight: 700;">${formatCurrency(p.customer10YearProfitNominal)}</td>
            <td style="color: #b45309;">${formatCurrency(p.customer10YearRealAsset)}</td>
            <td style="color: #059669;">${formatPercent(p.customerIRR * 100)}</td>
        `;
        tbody.appendChild(tr);
    });
}

function renderMonthlyTable(data) {
    const tbody = document.getElementById('monthlyTableBody');
    tbody.innerHTML = '';
    // نمایش ۳۶ ماه اول یا گزینش ماه‌ها
    const displayList = data.monthlySchedule.slice(0, 36);
    displayList.forEach(m => {
        const tr = document.createElement('tr');
        if (data.nominalBreakevenMonth === m.month) tr.classList.add('breakeven-row');
        tr.innerHTML = `
            <td>${formatNumber(m.month)}</td>
            <td>${formatCurrency(m.monthlyInstallment)}</td>
            <td>${formatCurrency(m.monthlyPrincipalPaid)}</td>
            <td>${formatCurrency(m.monthlyInterestPaid)}</td>
            <td>${formatCurrency(m.remainingLoanBalance)}</td>
            <td>${formatCurrency(m.fundValueEnding)}</td>
            <td style="font-weight: 700;">${formatCurrency(m.netSurrenderValue)}</td>
            <td>${formatCurrency(m.cumulativeCustomerOutflow)}</td>
            <td style="color: ${m.customerNominalProfitOrLoss >= 0 ? '#059669' : '#dc2626'};">${formatCurrency(m.customerNominalProfitOrLoss)}</td>
        `;
        tbody.appendChild(tr);
    });
}

// بارگذاری سناریوهای پیش‌فرض
function loadPreset(presetType) {
    document.querySelectorAll('.btn-preset').forEach(b => b.classList.remove('active'));
    event.target.classList.add('active');

    if (presetType === 'standard') {
        currentModel.bankLoanAnnualInterestRate = 0.23;
        currentModel.bankLoanTenureMonths = 24;
        currentModel.fundAnnualReturnRate = 0.30;
        currentModel.annualInflationRate = 0.40;
        currentModel.agentCommissionRate = 0.02;
    } else if (presetType === 'qard') {
        currentModel.bankLoanAnnualInterestRate = 0.04;
        currentModel.bankLoanTenureMonths = 36;
        currentModel.fundAnnualReturnRate = 0.28;
        currentModel.annualInflationRate = 0.40;
        currentModel.bankFeeRate = 0.04;
        currentModel.bankBlockedDepositRate = 0.0;
    } else if (presetType === 'hyper') {
        currentModel.bankLoanAnnualInterestRate = 0.23;
        currentModel.bankLoanTenureMonths = 24;
        currentModel.fundAnnualReturnRate = 0.45;
        currentModel.annualInflationRate = 0.55;
    } else if (presetType === 'direct') {
        currentModel.agentCommissionRate = 0.0;
        currentModel.bankLoanAnnualInterestRate = 0.23;
        currentModel.fundAnnualReturnRate = 0.32;
    }

    // به‌روزرسانی کنترل‌های ورودی در فرم
    syncFormInputs();
    fetchSimulation();
}

function syncFormInputs() {
    for (const [key, val] of Object.entries(currentModel)) {
        const input = document.getElementById(key);
        const slider = document.getElementById(key + 'Slider');
        let displayVal = val;

        if (key.includes('Rate')) {
            displayVal = val * 100;
        }

        if (input) input.value = displayVal;
        if (slider) slider.value = displayVal;
        updateDisplayLabel(key, displayVal);
    }
}

// خروجی اکسل / CSV
function exportToCsv() {
    if (!currentData || !currentData.monthlySchedule) return;
    let csvContent = "\uFEFFماه,قسط ماهانه,اصل قسط,سود قسط,مانده وام,ارزش صندوق,ارزش خالص بازخرید,کل پرداختی مشتری,سود اسمی\n";
    currentData.monthlySchedule.forEach(m => {
        csvContent += `${m.month},${m.monthlyInstallment},${m.monthlyPrincipalPaid},${m.monthlyInterestPaid},${m.remainingLoanBalance},${m.fundValueEnding},${m.netSurrenderValue},${m.cumulativeCustomerOutflow},${m.customerNominalProfitOrLoss}\n`;
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", "bancassurance_simulation.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// رندر بخش تحلیل استراتژیک شرکت بیمه
function renderInsuranceStrategicAnalysis(ins) {
    if (!ins) return;

    // آمار بالای تب
    document.getElementById('insStatInflow').textContent = formatCurrency(ins.upfrontCashInflow);
    document.getElementById('insStatUnderwriting').textContent = formatCurrency(ins.immediateRiskFreeProfit);
    document.getElementById('insStatAum').textContent = formatCurrency(ins.longTermManagementFees);
    document.getElementById('insStatNetProfit').textContent = formatCurrency(ins.netProfitAfterClaimsAndExpenses);
    document.getElementById('insStatCoverageY1').textContent = formatPercent(ins.year1CoverageRatio);
    document.getElementById('insStatSafeMonth').textContent = ins.monthsToFullCollateralCoverage > 0 
        ? `ماه ${formatNumber(ins.monthsToFullCollateralCoverage)}` 
        : 'از بدو شروع';

    // هشدارهای بحرانی
    const warnBox = document.getElementById('insActiveWarningsBox');
    const warnList = document.getElementById('insWarningsList');
    warnList.innerHTML = '';
    if (ins.criticalWarnings && ins.criticalWarnings.length > 0) {
        warnBox.style.display = 'block';
        ins.criticalWarnings.forEach(w => {
            const li = document.createElement('li');
            li.textContent = w;
            warnList.appendChild(li);
        });
    } else {
        warnBox.style.display = 'none';
    }

    // مزایا
    const prosContainer = document.getElementById('insProsContainer');
    prosContainer.innerHTML = '';
    ins.advantages.forEach(a => {
        const card = document.createElement('div');
        card.className = 'strategic-card pros-card';
        card.innerHTML = `
            <div class="card-top-meta">
                <span class="card-category">${a.category}</span>
                <span class="impact-badge ${getImpactClass(a.impactLevel)}">${a.impactLevel}</span>
            </div>
            <div class="strategic-title">✨ ${a.title}</div>
            <div class="strategic-desc">${a.description}</div>
            ${a.monetaryValue ? `<div class="strategic-monetary">عایدی مالی: ${formatCurrency(a.monetaryValue)}</div>` : ''}
        `;
        prosContainer.appendChild(card);
    });

    // معایب و ریسک‌ها
    const consContainer = document.getElementById('insConsContainer');
    consContainer.innerHTML = '';
    ins.disadvantagesAndRisks.forEach(r => {
        const card = document.createElement('div');
        card.className = 'strategic-card cons-card';
        card.innerHTML = `
            <div class="card-top-meta">
                <span class="card-category">${r.category}</span>
                <span class="impact-badge ${getImpactClass(r.impactLevel)}">${r.impactLevel}</span>
            </div>
            <div class="strategic-title">⚠️ ${r.title}</div>
            <div class="strategic-desc">${r.description}</div>
            ${r.monetaryValue ? `<div class="strategic-monetary" style="color: #991b1b; background: #fee2e2;">ریسک مالی در معرض: ${formatCurrency(r.monetaryValue)}</div>` : ''}
        `;
        consContainer.appendChild(card);
    });

    // توصیه‌ها
    const recsList = document.getElementById('insRecommendationsList');
    recsList.innerHTML = '';
    ins.strategicRecommendations.forEach(rec => {
        const li = document.createElement('li');
        li.textContent = rec;
        recsList.appendChild(li);
    });
}

function getImpactClass(level) {
    if (level === 'بحرانی' || level === 'Critical') return 'critical';
    if (level === 'بالا' || level === 'بسیار بالا' || level === 'High') return 'high';
    if (level === 'متوسط' || level === 'Medium') return 'medium';
    return 'low';
}

