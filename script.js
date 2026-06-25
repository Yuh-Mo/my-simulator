let chartInstance = null;
const ids = [
    'simYears', 'monthlyIncome', 'solarIncome', 'annualBonus', 'baseLivingCostActive', 'initCash', 'initAsset', 'monthly積立', 'yieldRate',
    'enableGeometric', 'volatility',
    'enableInvestEvent', 'investEventStart', 'investEventDuration', 'investEventAmount',
    'loanRate', 'loanRetireBalance', 'monthlyLoan', 'loanEndYear', 'enableLoanChange', 'loanChangeStart', 'loanChangeEnd', 'loanChangeAmount',
    'flexStart1', 'flexEnd1', 'flexCost1', 'flexStart2', 'flexEnd2', 'flexCost2',
    'retireYear', 'retirementPay', 'livingCostOld', 'postRetireIncome', 'postRetireStart', 'postRetireEnd', 'retireYieldRate', 'pensionStartYear', 'pensionMonthly',
    'eventStartYear', 'eventEndYear', 'eventYieldRate'
];
const groupToggleIds = [
    'groupActiveIncome', 'groupNisa', 'groupLifeEvents', 'groupLoan', 'groupFlexCost', 'groupRetire', 'groupMarketEvent'
];

function step(id, delta) {
    const el = document.getElementById(id);
    if (!el) return;
    let val = parseFloat(el.value) || 0;
    val += delta;
    
    if (id === 'loanRate') {
        el.value = parseFloat(val.toFixed(2));
    } else if (['yieldRate', 'retireYieldRate', 'monthlyLoan', 'loanChangeAmount', 'eventYieldRate'].includes(id)) {
        el.value = parseFloat(val.toFixed(1));
    } else {
        el.value = Math.round(val);
    }
    updateChart();
}

function toggleSections() {
    groupToggleIds.forEach(id => {
        const chk = document.getElementById(id);
        const box = document.getElementById('box_' + id);
        const title = document.getElementById('title_' + id);
        if (chk && box) {
            if (chk.checked) {
                box.classList.remove('collapsed-group');
                if (title) title.classList.add('active-group');
            } else {
                box.classList.add('collapsed-group');
                if (title) title.classList.remove('active-group');
            }
        }
    });

    const subConfigs = [
        { chk: 'enableGeometric', target: 'fields_enableGeometric' },
        { chk: 'enableInvestEvent', target: 'fields_enableInvestEvent' },
        { chk: 'enableLoanChange', target: 'fields_enableLoanChange' }
    ];
    subConfigs.forEach(conf => {
        const chk = document.getElementById(conf.chk);
        const fld = document.getElementById(conf.target);
        if (chk && fld) {
            if (chk.checked) fld.classList.add('show');
            else fld.classList.remove('show');
        }
    });

    updateChart();
}

function runCoreEngine(v, isRouteA) {
    let cash = v.initCash;
    let invest = v.initAsset;
    let principal = v.initAsset; 
    let retireYear = v.retireYear;
    let currentLoan = v.loanRetireBalance;
    const timeline = [];

    const loanYearlyRate = (v.loanRate / 100) || 0;
    const loanMonthlyRate = loanYearlyRate / 12;

    if (v.groupLoan) {
        for (let y = retireYear; y >= 1; y--) {
            let activeMonthlyLoan = v.monthlyLoan;
            if (v.enableLoanChange && y >= v.loanChangeStart && y <= v.loanChangeEnd) {
                activeMonthlyLoan = v.loanChangeAmount;
            }
            for (let m = 12; m >= 1; m--) {
                currentLoan = (currentLoan + activeMonthlyLoan) / (1 + loanMonthlyRate);
            }
        }
    }

    timeline.push({
        year: 0,
        cash: cash,
        invest: invest,
        principal: principal,
        profit: 0,
        loan: Math.round(currentLoan),
        total: cash + invest,
        eventName: '',
        appliedRate: 0
    });

    const years = Math.max(1, v.simYears);

    for (let y = 1; y <= years; y++) {
        let isRetire = v.groupRetire ? (y > v.retireYear) : false;
        let eventText = "";
        let currentYield = 0;

        if (v.groupNisa) {
            let baseYield = isRetire ? v.retireYieldRate : v.yieldRate;
            
            if (v.groupMarketEvent && y >= v.eventStartYear && y <= v.eventEndYear) {
                baseYield = v.eventYieldRate;
                eventText += (eventText ? "＋" : "") + "大暴落期";
            }

            if (v.enableGeometric) {
                const volDec = v.volatility / 100;
                const penalty = (volDec * volDec) / 2 * 100;
                baseYield = baseYield - penalty;
            }
            
            currentYield = baseYield;
        }

        if (v.groupNisa && invest > 0) {
            invest = invest * (1 + (currentYield / 100));
        }

        let flexOutgo = 0;
        if (v.groupFlexCost) {
            if (y >= v.flexStart1 && y <= v.flexEnd1) flexOutgo += v.flexCost1 * 12;
            if (y >= v.flexStart2 && y <= v.flexEnd2) flexOutgo += v.flexCost2 * 12;
        }

        let lifeEventCost = 0;
        if (v.groupLifeEvents) {
            for (let i = 1; i <= 5; i++) {
                let evY = parseInt(document.getElementById(`evYear${i}`).value) || 0;
                let evC = parseFloat(document.getElementById(`evCost${i}`).value) || 0;
                let evN = document.getElementById(`evName${i}`).value;
                if (evY === y) {
                    lifeEventCost += evC;
                    if (evN) {
                        eventText += (eventText ? "＋" : "") + `${evN}(${evC.toLocaleString()}万円)`;
                    }
                }
            }
        }

        let activeMonthlyLoan = v.monthlyLoan;
        if (v.enableLoanChange && y >= v.loanChangeStart && y <= v.loanChangeEnd) {
            activeMonthlyLoan = v.loanChangeAmount;
        }

        let annualLoanRepayment = 0;
        if (v.groupLoan) {
            if (y <= v.loanEndYear) {
                if (y === (retireYear + 1) && isRouteA) {
                    currentLoan = 0;
                    annualLoanRepayment = 0;
                } else if (y > retireYear && isRouteA) {
                    currentLoan = 0;
                    annualLoanRepayment = 0;
                } else {
                    for (let m = 1; m <= 12; m++) {
                        currentLoan = currentLoan * (1 + loanMonthlyRate) - activeMonthlyLoan;
                    }
                    if (currentLoan < 0) currentLoan = 0;
                    annualLoanRepayment = activeMonthlyLoan * 12;
                }
            } else {
                currentLoan = 0;
            }
        }

        if (!isRetire) {
            let monthlyIn = v.groupActiveIncome ? (v.monthlyIncome + v.solarIncome) : 0;
            let monthlyOut = v.groupActiveIncome ? v.baseLivingCostActive : 0;
            let annualBonusIn = v.groupActiveIncome ? v.annualBonus : 0;

            let baseSurplus = ((monthlyIn - monthlyOut) * 12) + annualBonusIn - flexOutgo - annualLoanRepayment - lifeEventCost;
            cash += baseSurplus;

            let targetNisa = 0;
            if (v.groupNisa && principal < 1800) {
                let monthly積立額 = v.monthly積立;
                if (v.enableInvestEvent && y >= v.investEventStart && y < (v.investEventStart + v.investEventDuration)) {
                    monthly積立額 = v.investEventAmount;
                }
                targetNisa = monthly積立額 * 12;
            }

            if (targetNisa > 0) {
                if (cash >= targetNisa) {
                    cash -= targetNisa;
                    invest += targetNisa;
                    principal = Math.min(1800, principal + targetNisa);
                } else {
                    let clearAmount = Math.max(0, cash);
                    cash = 0;
                    invest += clearAmount;
                    principal = Math.min(1800, principal + clearAmount);
                }
            }

            if (cash < 0) {
                let deficit = Math.abs(cash);
                if (invest >= deficit) {
                    invest -= deficit;
                    principal = Math.max(0, principal - deficit);
                    cash = 0;
                } else {
                    cash = invest - deficit; 
                    invest = 0;
                    principal = 0;
                }
            }

        } else {
            let monthlyPension = (v.groupRetire && y >= v.pensionStartYear) ? v.pensionMonthly : 0;
            let monthlyOutOld = v.groupRetire ? v.livingCostOld : 0;
            
            let postRetireIn = 0;
            if (v.groupRetire && y >= v.postRetireStart && y <= v.postRetireEnd) {
                postRetireIn = v.postRetireIncome;
            }

            let annualInOld = (monthlyPension + postRetireIn) * 12;
            let annualOutOld = ((monthlyOutOld + flexOutgo) * 12) + annualLoanRepayment + lifeEventCost;

            if (y === (retireYear + 1)) {
                let retirementPayIn = v.groupRetire ? v.retirementPay : 0;
                cash += retirementPayIn;
                eventText += (eventText ? "＋" : "") + "定年退職";

                if (isRouteA) {
                    let requiredPayoff = v.loanRetireBalance; 
                    cash -= requiredPayoff;
                    eventText += "・ローン一括返済";
                } else {
                    eventText += "・分割返済継続";
                }
            }

            cash += (annualInOld - annualOutOld);

            if (cash < 0) {
                let deficit = Math.abs(cash);
                if (invest >= deficit) {
                    invest -= deficit;
                    principal = Math.max(0, principal - deficit);
                    cash = 0;
                } else {
                    let left = deficit - invest;
                    cash = -left; 
                    invest = 0;
                    principal = 0;
                }
            }
        }

        timeline.push({
            year: y,
            cash: Math.round(cash),
            invest: Math.round(invest),
            principal: Math.round(principal),
            profit: Math.round(Math.max(0, invest - principal)),
            loan: Math.round(currentLoan),
            total: Math.round(cash + invest),
            eventName: eventText,
            appliedRate: parseFloat(currentYield.toFixed(2))
        });
    }

    return timeline;
}

function calculateSimulation() {
    const v = {};
    ids.forEach(id => {
        const el = document.getElementById(id);
        if (!el) return;
        if (el.type === 'checkbox') {
            v[id] = el.checked;
        } else if (el.type === 'number') {
            v[id] = parseFloat(el.value) || 0;
        } else {
            v[id] = el.value;
        }
    });

    groupToggleIds.forEach(id => {
        const el = document.getElementById(id);
        v[id] = el ? el.checked : false;
    });

    const inc = (parseFloat(document.getElementById('monthlyIncome').value) || 0) + (parseFloat(document.getElementById('solarIncome').value) || 0);
    const out = (parseFloat(document.getElementById('baseLivingCostActive').value) || 0) + (v.groupLoan ? (parseFloat(document.getElementById('monthlyLoan').value) || 0) : 0);
    const surplusEl = document.getElementById('val_monthlySurplus');
    if (surplusEl) {
        const diff = inc - out;
        surplusEl.textContent = (diff > 0 ? '+' : '') + diff.toFixed(1) + " 万円/月";
    }

    const routeA = runCoreEngine(v, false); // プランA ＝ 定年後も分割返済継続
    const routeB = runCoreEngine(v, true);  // プランB ＝ 定年時に一括返済

    return { routeA, routeB };
}

function updateChart() {
    const { routeA, routeB } = calculateSimulation();
    const labels = routeA.map(d => d.year + '年目');

    if (chartInstance) {
        chartInstance.destroy();
    }

    const ctx = document.getElementById('mainChart').getContext('2d');
    chartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [
                {
                    label: '【プランA】定年後も分割返済継続',
                    data: routeA.map(d => d.total),
                    borderColor: '#2980b9',
                    backgroundColor: 'rgba(41, 128, 185, 0.05)',
                    borderWidth: 3,
                    pointRadius: routeA.map(d => d.eventName ? 6 : 2),
                    pointBackgroundColor: routeA.map(d => d.eventName ? '#e74c3c' : '#2980b9'),
                    tension: 0.1
                },
                {
                    label: '【プランB】定年時にローン一括返済',
                    data: routeB.map(d => d.total),
                    borderColor: '#27ae60',
                    backgroundColor: 'rgba(39, 174, 96, 0.05)',
                    borderWidth: 3,
                    pointRadius: routeB.map(d => d.eventName ? 6 : 2),
                    pointBackgroundColor: routeB.map(d => d.eventName ? '#e67e22' : '#27ae60'),
                    tension: 0.1
                },
                {
                    label: '住宅ローンの残り残高（プランA時）',
                    data: routeA.map(d => d.loan),
                    borderColor: '#95a5a6',
                    borderDash: [5, 5],
                    borderWidth: 2,
                    pointRadius: 0,
                    fill: false,
                    tension: 0.1
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: { mode: 'index', intersect: false },
            plugins: {
                legend: { position: 'top', labels: { boxWidth: 12, font: { size: 11 } } },
                tooltip: {
                    padding: 10,
                    bodySpacing: 5,
                    callbacks: {
                        label: function(context) {
                            const yearIndex = context.dataIndex;
                            const dA = routeA[yearIndex];
                            const dB = routeB[yearIndex];
                            
                            if (context.datasetIndex === 0) {
                                return [
                                    `【プランA: 定年後も分割返済を継続】`,
                                    `   💰 資産の合計: ${dA.total.toLocaleString()} 万円`,
                                    `   ├ 💵 現金預金: ${dA.cash.toLocaleString()} 万円`,
                                    `   └ 📈 投資の残高: ${dA.invest.toLocaleString()} 万円 (うち元金: ${dA.principal.toLocaleString()} 万円)`,
                                    `   📊 実際の利回り: ${dA.appliedRate} %`
                                ];
                            } else if (context.datasetIndex === 1) {
                                return [
                                    `【プランB: 定年時に一括返済】`,
                                    `   💰 資産の合計: ${dB.total.toLocaleString()} 万円`,
                                    `   ├ 💵 現金預金: ${dB.cash.toLocaleString()} 万円`,
                                    `   └ 📈 投資の残高: ${dB.invest.toLocaleString()} 万円 (うち元金: ${dB.principal.toLocaleString()} 万円)`,
                                    `   📊 実際の利回り: ${dB.appliedRate} %`
                                ];
                            } else if (context.datasetIndex === 2) {
                                return `🏠 ローンの残り残高: ${dA.loan.toLocaleString()} 万円`;
                            }
                        },
                        footer: function(contexts) {
                            const yearIndex = contexts[0].dataIndex;
                            const dA = routeA[yearIndex];
                            const dB = routeB[yearIndex];
                            const footerTexts = [];
                            if (dA.eventName || dB.eventName) {
                                let combinedEvent = Array.from(new Set([dA.eventName, dB.eventName].filter(Boolean))).join(' / ');
                                footerTexts.push(`🔥 人生のイベント: ${combinedEvent}`);
                            }
                            return footerTexts.join('\n');
                        }
                    }
                }
            },
            scales: {
                y: { ticks: { callback: function(value) { return value.toLocaleString() + '万'; } } }
            }
        }
    });
}

function exportToFile() {
    const config = {};
    ids.forEach(id => {
        const el = document.getElementById(id);
        if (el) config[id] = el.type === 'checkbox' ? el.checked : el.value;
    });
    for (let i = 1; i <= 5; i++) {
        config[`evName${i}`] = document.getElementById(`evName${i}`).value;
        config[`evYear${i}`] = document.getElementById(`evYear${i}`).value;
        config[`evCost${i}`] = document.getElementById(`evCost${i}`).value;
    }
    groupToggleIds.forEach(id => {
        const el = document.getElementById(id);
        if (el) config[id] = el.checked;
    });
    const blob = new Blob([JSON.stringify(config, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `資産寿命ダブルシミュレーター設定_${new Date().toISOString().slice(0,10).replace(/-/g,'')}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

function importFromFile(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const config = JSON.parse(e.target.result);
            ids.forEach(id => {
                const el = document.getElementById(id);
                if (el && config[id] !== undefined) {
                    if (el.type === 'checkbox') el.checked = config[id];
                    else el.value = config[id];
                }
            });
            for (let i = 1; i <= 5; i++) {
                if (config[`evName${i}`] !== undefined) document.getElementById(`evName${i}`).value = config[`evName${i}`];
                if (config[`evYear${i}`] !== undefined) document.getElementById(`evYear${i}`).value = config[`evYear${i}`];
                if (config[`evCost${i}`] !== undefined) document.getElementById(`evCost${i}`).value = config[`evCost${i}`];
            }
            groupToggleIds.forEach(id => {
                const el = document.getElementById(id);
                if (el && config[id] !== undefined) el.checked = config[id];
            });
            toggleSections();
        } catch (err) {
            alert("読み込みエラー。有効な設定JSONか確認してください。");
        }
    };
    reader.readAsText(file);
}

function initDynamicTooltips() {
    const icons = document.querySelectorAll('.help-icon');
    const panel = document.getElementById('sidebarPanel');

    icons.forEach(icon => {
        icon.addEventListener('mouseenter', () => {
            if (window.innerWidth <= 768) return; // スマホ時はCSS側で制御
            const tooltip = icon.querySelector('.tooltip');
            if (!tooltip) return;

            const iconRect = icon.getBoundingClientRect();
            const panelRect = panel.getBoundingClientRect();
            const tooltipWidth = 230;

            let leftOffset = 18;
            const predictedRight = iconRect.left + leftOffset + tooltipWidth;
            if (predictedRight > panelRect.right - 10) {
                leftOffset = (panelRect.right - iconRect.left) - tooltipWidth - 10;
            }
            tooltip.style.left = `${leftOffset}px`;
        });
    });
}

window.onload = function() {
    toggleSections();
    initDynamicTooltips();
};