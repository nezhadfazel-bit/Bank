using BancassuranceSim.Web.Models;

namespace BancassuranceSim.Web.Services;

public class CalculationService : ICalculationService
{
    public SimulationResultModel Calculate(ContractInputModel input)
    {
        var result = new SimulationResultModel();

        // ۱. تراز افتتاحیه و تفکیک اولیه وجوه
        result.TotalPolicyNominalValue = input.TotalPolicyValue;
        result.CustomerInitialCash = input.CustomerInitialCash;
        result.BankLoanAmount = input.BankLoanAmount;

        // کسورات بانک
        result.BankFeeAmount = input.BankLoanAmount * input.BankFeeRate; // ۶.۵٪
        result.BankBlockedDepositAmount = input.BankLoanAmount * input.BankBlockedDepositRate; // ۴٪

        // کسورات بیمه و نماینده
        result.InsuranceUnderwritingFeeAmount = input.TotalPolicyValue * input.InsuranceUnderwritingFeeRate; // ۵٪
        result.LifeCoverageFeeAmount = input.TotalPolicyValue * input.LifeCoverageFeeRate; // ۵٪
        result.AgentCommissionAmount = input.TotalPolicyValue * input.AgentCommissionRate;

        // محاسبه واریزی خالص اولیه به صندوق
        decimal netLoanProceeds = input.BankLoanAmount;
        decimal customerInitialOutflow = input.CustomerInitialCash;

        if (input.DeductBankChargesFromLoanProceeds)
        {
            netLoanProceeds -= (result.BankFeeAmount + result.BankBlockedDepositAmount);
        }
        else
        {
            // بیمه‌گذار کارمزد و مسدودی را نقداً جداگانه پرداخت می‌کند
            customerInitialOutflow += (result.BankFeeAmount + result.BankBlockedDepositAmount);
        }

        // کسر هزینه‌های بیمه و نماینده از صندوق
        decimal totalUpfrontDeductionsFromFund = result.InsuranceUnderwritingFeeAmount + result.LifeCoverageFeeAmount;
        if (input.AgentCommissionFromCustomer)
        {
            totalUpfrontDeductionsFromFund += result.AgentCommissionAmount;
        }

        result.NetInitialFundDeposit = Math.Max(0, (input.CustomerInitialCash + netLoanProceeds) - totalUpfrontDeductionsFromFund);
        result.EffectiveCustomerInitialPayment = customerInitialOutflow;

        // ۲. جدول استهلاک وام بانکی (Amortization Schedule)
        int n = Math.Max(1, input.BankLoanTenureMonths);
        decimal monthlyLoanRate = input.BankLoanAnnualInterestRate / 12.0m;
        decimal monthlyInstallment;

        if (monthlyLoanRate <= 0.000001m)
        {
            monthlyInstallment = input.BankLoanAmount / n;
        }
        else
        {
            double r = (double)monthlyLoanRate;
            double pmt = (double)input.BankLoanAmount * (r * Math.Pow(1.0 + r, n)) / (Math.Pow(1.0 + r, n) - 1.0);
            monthlyInstallment = (decimal)pmt;
        }

        result.MonthlyInstallment = monthlyInstallment;
        result.TotalInstallmentsAmount = monthlyInstallment * n;
        result.TotalLoanInterestAmount = Math.Max(0, result.TotalInstallmentsAmount - input.BankLoanAmount);

        // ۳. شبیه‌سازی ماهانه (Monthly Simulation)
        int totalMonths = Math.Max(1, input.SimulationYears * 12);
        decimal monthlyFundReturnRate = (decimal)(Math.Pow(1.0 + (double)input.FundAnnualReturnRate, 1.0 / 12.0) - 1.0);
        decimal monthlyInflationRate = (decimal)(Math.Pow(1.0 + (double)input.AnnualInflationRate, 1.0 / 12.0) - 1.0);

        decimal currentFundValue = result.NetInitialFundDeposit;
        decimal currentLoanBalance = input.BankLoanAmount;
        decimal cumulativePaidByCustomer = customerInitialOutflow;
        decimal cumulativeDiscountedCustomerOutflow = customerInitialOutflow;

        int? nominalBreakevenMonth = null;
        int? realBreakevenMonth = null;

        var monthlySchedule = new List<MonthlyScheduleItem>();
        var customerCashFlows = new List<decimal> { -customerInitialOutflow };

        for (int m = 1; m <= totalMonths; m++)
        {
            var item = new MonthlyScheduleItem { Month = m };

            // قسط وام در ماه جاری
            decimal installmentThisMonth = 0;
            decimal principalThisMonth = 0;
            decimal interestThisMonth = 0;

            if (m <= n && currentLoanBalance > 0)
            {
                interestThisMonth = currentLoanBalance * monthlyLoanRate;
                if (m == n)
                {
                    principalThisMonth = currentLoanBalance;
                    installmentThisMonth = principalThisMonth + interestThisMonth;
                    currentLoanBalance = 0m;
                }
                else
                {
                    principalThisMonth = Math.Min(currentLoanBalance, monthlyInstallment - interestThisMonth);
                    installmentThisMonth = principalThisMonth + interestThisMonth;
                    currentLoanBalance = Math.Max(0, currentLoanBalance - principalThisMonth);
                    if (currentLoanBalance < 0.01m) currentLoanBalance = 0m;
                }
            }

            cumulativePaidByCustomer += installmentThisMonth;
            customerCashFlows.Add(-installmentThisMonth);

            item.MonthlyInstallment = installmentThisMonth;
            item.MonthlyPrincipalPaid = principalThisMonth;
            item.MonthlyInterestPaid = interestThisMonth;
            item.RemainingLoanBalance = currentLoanBalance;
            item.CumulativeLoanPaid = cumulativePaidByCustomer - customerInitialOutflow;
            item.CumulativeCustomerOutflow = cumulativePaidByCustomer;

            // رشد صندوق
            item.FundValueBeginning = currentFundValue;
            item.MonthlyFundReturn = currentFundValue * monthlyFundReturnRate;
            currentFundValue += item.MonthlyFundReturn;

            // بازگشت سپرده مسدود شده در ماه ۱۲ (اگر از وام کسر شده بود، به صندوق افزوده می‌شود)
            if (m == input.BankBlockedDepositDurationMonths)
            {
                if (input.DeductBankChargesFromLoanProceeds)
                {
                    currentFundValue += result.BankBlockedDepositAmount;
                }
            }

            item.FundValueEnding = currentFundValue;

            // ارزش بازخرید خالص (حقوق صاحبان بیمه‌نامه)
            item.NetSurrenderValue = Math.Max(0, currentFundValue - currentLoanBalance);
            item.CustomerNominalProfitOrLoss = item.NetSurrenderValue - cumulativePaidByCustomer;
            item.CustomerProfitPercentage = cumulativePaidByCustomer > 0 
                ? (item.CustomerNominalProfitOrLoss / cumulativePaidByCustomer) * 100m 
                : 0m;

            // تورم و ارزش واقعی
            decimal inflationFactor = (decimal)Math.Pow(1.0 + (double)monthlyInflationRate, -m);
            item.InflationDiscountFactor = inflationFactor;
            item.NetSurrenderValueReal = item.NetSurrenderValue * inflationFactor;

            // ارزش واقعی پرداختی‌های تنزیل‌شده به ابتدای دوره
            if (installmentThisMonth > 0)
            {
                cumulativeDiscountedCustomerOutflow += installmentThisMonth * inflationFactor;
            }
            item.CumulativeCustomerOutflowReal = cumulativeDiscountedCustomerOutflow;
            item.CustomerRealProfitOrLoss = item.NetSurrenderValueReal - cumulativeDiscountedCustomerOutflow;

            // سرمایه فوت در ماه m
            item.TotalDeathPayoutToBeneficiaries = Math.Max(0, input.LifeCoverageCapital + currentFundValue - currentLoanBalance);

            // بررسی نقطه سربه‌سر اسمی
            if (!nominalBreakevenMonth.HasValue && item.NetSurrenderValue >= cumulativePaidByCustomer)
            {
                nominalBreakevenMonth = m;
            }

            // بررسی نقطه سربه‌سر واقعی
            if (!realBreakevenMonth.HasValue && item.NetSurrenderValueReal >= cumulativeDiscountedCustomerOutflow)
            {
                realBreakevenMonth = m;
            }

            monthlySchedule.Add(item);
        }

        result.MonthlySchedule = monthlySchedule;
        result.NominalBreakevenMonth = nominalBreakevenMonth;
        result.RealBreakevenMonth = realBreakevenMonth;

        if (nominalBreakevenMonth.HasValue)
        {
            int yr = (nominalBreakevenMonth.Value - 1) / 12 + 1;
            int mo = (nominalBreakevenMonth.Value - 1) % 12 + 1;
            result.BreakevenStatusMessage = $"سرمایه‌گذاری در ماه {nominalBreakevenMonth.Value} (سال {yr}، ماه {mo}) به نقطه سربه‌سر اسمی می‌رسد.";
        }
        else
        {
            result.BreakevenStatusMessage = "در بازه زمانی انتخابی، نقطه سربه‌سر اسمی محقق نمی‌شود.";
        }

        // ۴. خلاصه‌های سالانه (Yearly Summaries)
        var yearlySummaries = new List<YearlySummaryItem>();
        for (int y = 1; y <= input.SimulationYears; y++)
        {
            int targetMonthIndex = (y * 12) - 1;
            if (targetMonthIndex < monthlySchedule.Count)
            {
                var mItem = monthlySchedule[targetMonthIndex];
                yearlySummaries.Add(new YearlySummaryItem
                {
                    Year = y,
                    CumulativePaid = mItem.CumulativeCustomerOutflow,
                    FundValueNominal = mItem.FundValueEnding,
                    RemainingLoan = mItem.RemainingLoanBalance,
                    NetEquityNominal = mItem.NetSurrenderValue,
                    NetEquityReal = mItem.NetSurrenderValueReal,
                    CustomerProfitNominal = mItem.CustomerNominalProfitOrLoss,
                    CustomerProfitReal = mItem.CustomerRealProfitOrLoss,
                    ReturnOnInvestmentNominalPct = mItem.CustomerProfitPercentage,
                    ReturnOnInvestmentRealPct = mItem.CumulativeCustomerOutflowReal > 0 
                        ? (mItem.CustomerRealProfitOrLoss / mItem.CumulativeCustomerOutflowReal) * 100m 
                        : 0m,
                    IsBreakevenNominal = nominalBreakevenMonth.HasValue && (y * 12) >= nominalBreakevenMonth.Value,
                    IsBreakevenReal = realBreakevenMonth.HasValue && (y * 12) >= realBreakevenMonth.Value,
                    DeathBenefitNet = mItem.TotalDeathPayoutToBeneficiaries
                });
            }
        }
        result.YearlySummaries = yearlySummaries;

        // ۵. شاخص‌های کلی عملکرد مشتری در پایان دوره شبیه‌سازی
        var finalMonthItem = monthlySchedule.Last();
        result.CustomerFinalNominalFund = finalMonthItem.NetSurrenderValue;
        result.CustomerTotalPayments = finalMonthItem.CumulativeCustomerOutflow;
        result.CustomerNominalGain = finalMonthItem.CustomerNominalProfitOrLoss;
        result.CustomerRealGain = finalMonthItem.CustomerRealProfitOrLoss;
        result.CustomerNominalROI = finalMonthItem.CustomerProfitPercentage;

        // محاسبه IRR بیمه‌گذار
        customerCashFlows[customerCashFlows.Count - 1] += finalMonthItem.NetSurrenderValue;
        result.CustomerAnnualIRR = CalculateMonthlyIRR(customerCashFlows);
        result.CustomerRealIRR = ((1.0m + result.CustomerAnnualIRR) / (1.0m + input.AnnualInflationRate)) - 1.0m;

        // ۶. سود و زیان ذی‌نفعان (Stakeholders PnL)
        var pnl = new StakeholderPnL();

        // الف) مشتری
        pnl.CustomerTotalOutflows = finalMonthItem.CumulativeCustomerOutflow;
        pnl.CustomerFinalNominalAsset = finalMonthItem.NetSurrenderValue;
        pnl.CustomerFinalRealAsset = finalMonthItem.NetSurrenderValueReal;
        pnl.CustomerNominalNetGain = finalMonthItem.CustomerNominalProfitOrLoss;
        pnl.CustomerRealNetGain = finalMonthItem.CustomerRealProfitOrLoss;
        pnl.CustomerAnnualizedIRR = result.CustomerAnnualIRR;

        // ب) بانک
        pnl.BankUpfrontFeeIncome = result.BankFeeAmount; // کارمزد ۶.۵٪
        pnl.BankInterestIncome = result.TotalLoanInterestAmount;
        // منفعت رسوب سپرده مسدود (با فرض ارزش هزینه فرصت معادل نرخ بین بانکی/تسهیلات ۲۳٪ برای ۱ سال)
        pnl.BankBlockedDepositBenefit = result.BankBlockedDepositAmount * input.BankLoanAnnualInterestRate;
        pnl.BankTotalGrossRevenue = pnl.BankUpfrontFeeIncome + pnl.BankInterestIncome + pnl.BankBlockedDepositBenefit;

        // بازده مؤثر تسهیلات برای بانک:
        // جریان نقدی بانک: ماه ۰ خروجی (وام منهای کارمزد)، ماه‌های ۱ تا n دریافت اقساط، ماه ۱۲ عودت مسدودی
        var bankCashFlows = new List<decimal> { -(input.BankLoanAmount - result.BankFeeAmount) };
        for (int bm = 1; bm <= n; bm++)
        {
            decimal flow = monthlyInstallment;
            if (bm == input.BankBlockedDepositDurationMonths)
            {
                flow -= result.BankBlockedDepositAmount; // عودت سپرده
            }
            bankCashFlows.Add(flow);
        }
        pnl.BankEffectiveAnnualYield = CalculateMonthlyIRR(bankCashFlows);
        result.BankEffectiveAPR = pnl.BankEffectiveAnnualYield;

        // ج) شرکت بیمه
        pnl.InsuranceUnderwritingIncome = result.InsuranceUnderwritingFeeAmount; // ۵٪ بیمه‌گری
        pnl.InsuranceMortalityCoverageIncome = result.LifeCoverageFeeAmount; // ۵٪ پوشش فوت
        // کارمزد مدیریت سبد سرمایه‌گذاری (فرض سالانه ۰.۵٪ از ارزش میانگین صندوق)
        decimal avgFundValue = monthlySchedule.Average(x => x.FundValueEnding);
        pnl.InsuranceFundManagementIncome = avgFundValue * 0.005m * input.SimulationYears;
        pnl.InsuranceAgentCommissionExpense = result.AgentCommissionAmount;

        // برآورد ریسک مرگ‌ومیر اکچوئری بر اساس جدول فوت تقریبی در سن بیمه‌گذار
        decimal annualMortalityProb = EstimateAnnualMortalityRate(input.InsuredAge);
        decimal cumulativeMortalityRisk = 1.0m - (decimal)Math.Pow(1.0 - (double)annualMortalityProb, input.SimulationYears);
        pnl.InsuranceExpectedClaimExpense = input.LifeCoverageCapital * cumulativeMortalityRisk;
        pnl.InsuranceNetMargin = (pnl.InsuranceUnderwritingIncome + pnl.InsuranceMortalityCoverageIncome + pnl.InsuranceFundManagementIncome)
                                 - (pnl.InsuranceAgentCommissionExpense + pnl.InsuranceExpectedClaimExpense);

        result.Stakeholders = pnl;

        // ۷. سناریوهای فوت در سال‌های مختلف
        var deathScenarios = new List<MortalityScenarioItem>();
        int[] milestoneYears = { 1, 2, 3, 5, 10 };
        foreach (var yr in milestoneYears.Where(y => y <= input.SimulationYears))
        {
            int mIdx = (yr * 12) - 1;
            if (mIdx < monthlySchedule.Count)
            {
                var mItem = monthlySchedule[mIdx];
                decimal netPayout = input.LifeCoverageCapital + mItem.FundValueEnding - mItem.RemainingLoanBalance;
                deathScenarios.Add(new MortalityScenarioItem
                {
                    Year = yr,
                    LifeInsuranceBenefit = input.LifeCoverageCapital,
                    AccumulatedFundValue = mItem.FundValueEnding,
                    RemainingLoanToSettle = mItem.RemainingLoanBalance,
                    NetPayoutToFamily = netPayout,
                    TotalPremiumsAndInstallmentsPaid = mItem.CumulativeCustomerOutflow,
                    NetBenefitToFamilyRatio = mItem.CumulativeCustomerOutflow > 0 
                        ? (netPayout / mItem.CumulativeCustomerOutflow) 
                        : 0m
                });
            }
        }
        result.MortalityScenarios = deathScenarios;

        // ۸. تحلیل حساسیت (Sensitivity Analysis Matrix)
        result.SensitivityAnalysis = GenerateSensitivityAnalysis(input);

        // ۹. تحلیل استراتژیک، مزایا، معایب و ریسک‌های اختصاصی از ۳ زاویه (بیمه‌گذار، بانک، بیمه)
        result.CustomerAnalysis = GenerateCustomerStrategicAnalysis(input, result);
        result.BankAnalysis = GenerateBankStrategicAnalysis(input, result);
        result.InsuranceAnalysis = GenerateInsuranceStrategicAnalysis(input, result);

        return result;
    }

    public List<ContractInputModel> GetPresetScenarios()
    {
        return new List<ContractInputModel>
        {
            new()
            {
                // ۱. سناریوی استاندارد بانکی ۲۳٪
                TotalPolicyValue = 100_000_000m,
                CustomerInitialCash = 40_000_000m,
                BankLoanAmount = 60_000_000m,
                BankFeeRate = 0.065m,
                BankBlockedDepositRate = 0.04m,
                BankLoanAnnualInterestRate = 0.23m,
                BankLoanTenureMonths = 24,
                FundAnnualReturnRate = 0.32m,
                AnnualInflationRate = 0.40m,
                SimulationYears = 10
            },
            new()
            {
                // ۲. سناریوی تسهیلات قرض‌الحسنه ۴٪
                TotalPolicyValue = 100_000_000m,
                CustomerInitialCash = 40_000_000m,
                BankLoanAmount = 60_000_000m,
                BankFeeRate = 0.04m,
                BankBlockedDepositRate = 0.0m,
                BankLoanAnnualInterestRate = 0.04m,
                BankLoanTenureMonths = 36,
                FundAnnualReturnRate = 0.30m,
                AnnualInflationRate = 0.45m,
                SimulationYears = 10
            },
            new()
            {
                // ۳. سناریوی تورم حاد ۵۵٪ و بازده صندوق بالا ۴۵٪
                TotalPolicyValue = 100_000_000m,
                CustomerInitialCash = 40_000_000m,
                BankLoanAmount = 60_000_000m,
                BankFeeRate = 0.065m,
                BankBlockedDepositRate = 0.04m,
                BankLoanAnnualInterestRate = 0.23m,
                BankLoanTenureMonths = 24,
                FundAnnualReturnRate = 0.45m,
                AnnualInflationRate = 0.55m,
                SimulationYears = 10
            },
            new()
            {
                // ۴. سناریوی فروش مستقیم بدون نماینده (کارمزد صفر)
                TotalPolicyValue = 100_000_000m,
                CustomerInitialCash = 40_000_000m,
                BankLoanAmount = 60_000_000m,
                BankFeeRate = 0.065m,
                BankBlockedDepositRate = 0.04m,
                BankLoanAnnualInterestRate = 0.23m,
                BankLoanTenureMonths = 24,
                AgentCommissionRate = 0.0m,
                FundAnnualReturnRate = 0.30m,
                AnnualInflationRate = 0.40m,
                SimulationYears = 10
            }
        };
    }

    private List<SensitivityPoint> GenerateSensitivityAnalysis(ContractInputModel baseInput)
    {
        var list = new List<SensitivityPoint>();
        decimal[] testFundReturns = { 0.22m, 0.28m, 0.35m, 0.42m };
        decimal[] testInflations = { 0.30m, 0.40m, 0.50m };

        foreach (var fr in testFundReturns)
        {
            foreach (var inf in testInflations)
            {
                var clone = new ContractInputModel
                {
                    TotalPolicyValue = baseInput.TotalPolicyValue,
                    CustomerInitialCash = baseInput.CustomerInitialCash,
                    BankLoanAmount = baseInput.BankLoanAmount,
                    BankFeeRate = baseInput.BankFeeRate,
                    BankBlockedDepositRate = baseInput.BankBlockedDepositRate,
                    BankLoanAnnualInterestRate = baseInput.BankLoanAnnualInterestRate,
                    BankLoanTenureMonths = baseInput.BankLoanTenureMonths,
                    DeductBankChargesFromLoanProceeds = baseInput.DeductBankChargesFromLoanProceeds,
                    InsuranceUnderwritingFeeRate = baseInput.InsuranceUnderwritingFeeRate,
                    LifeCoverageFeeRate = baseInput.LifeCoverageFeeRate,
                    LifeCoverageCapital = baseInput.LifeCoverageCapital,
                    AgentCommissionRate = baseInput.AgentCommissionRate,
                    FundAnnualReturnRate = fr,
                    AnnualInflationRate = inf,
                    SimulationYears = 10,
                    InsuredAge = baseInput.InsuredAge
                };

                // محاسبه سریع برای این سناریو
                var sim = RunQuickSimulation(clone);
                list.Add(new SensitivityPoint
                {
                    FundReturnRate = fr,
                    LoanInterestRate = clone.BankLoanAnnualInterestRate,
                    InflationRate = inf,
                    BreakevenMonthNominal = sim.BreakevenMonthNominal,
                    Customer5YearProfitNominal = sim.Profit5Year,
                    Customer10YearProfitNominal = sim.Profit10Year,
                    Customer10YearRealAsset = sim.RealAsset10Year,
                    CustomerIRR = sim.IRR
                });
            }
        }

        return list;
    }

    private (int? BreakevenMonthNominal, decimal Profit5Year, decimal Profit10Year, decimal RealAsset10Year, decimal IRR) RunQuickSimulation(ContractInputModel input)
    {
        // محاسبه سریع برای ماتریس حساسیت
        decimal bankFee = input.BankLoanAmount * input.BankFeeRate;
        decimal bankBlocked = input.BankLoanAmount * input.BankBlockedDepositRate;
        decimal netLoan = input.DeductBankChargesFromLoanProceeds ? input.BankLoanAmount - bankFee - bankBlocked : input.BankLoanAmount;
        decimal deductions = (input.TotalPolicyValue * input.InsuranceUnderwritingFeeRate) +
                             (input.TotalPolicyValue * input.LifeCoverageFeeRate) +
                             (input.AgentCommissionFromCustomer ? input.TotalPolicyValue * input.AgentCommissionRate : 0m);

        decimal initialFund = Math.Max(0, (input.CustomerInitialCash + netLoan) - deductions);
        decimal initialPaid = input.DeductBankChargesFromLoanProceeds ? input.CustomerInitialCash : input.CustomerInitialCash + bankFee + bankBlocked;

        int n = Math.Max(1, input.BankLoanTenureMonths);
        decimal monthlyRate = input.BankLoanAnnualInterestRate / 12.0m;
        decimal pmt = monthlyRate <= 0 ? input.BankLoanAmount / n : (decimal)((double)input.BankLoanAmount * ((double)monthlyRate * Math.Pow(1.0 + (double)monthlyRate, n)) / (Math.Pow(1.0 + (double)monthlyRate, n) - 1.0));

        decimal monthlyFundReturn = (decimal)(Math.Pow(1.0 + (double)input.FundAnnualReturnRate, 1.0 / 12.0) - 1.0);
        decimal monthlyInf = (decimal)(Math.Pow(1.0 + (double)input.AnnualInflationRate, 1.0 / 12.0) - 1.0);

        decimal fund = initialFund;
        decimal loan = input.BankLoanAmount;
        decimal paid = initialPaid;

        int? be = null;
        decimal p5 = 0;
        decimal p10 = 0;
        decimal r10 = 0;

        var cfs = new List<decimal> { -initialPaid };

        for (int m = 1; m <= 120; m++)
        {
            decimal inst = 0;
            if (m <= n && loan > 0)
            {
                decimal interest = loan * monthlyRate;
                decimal principal = Math.Min(loan, pmt - interest);
                inst = principal + interest;
                loan -= principal;
            }

            paid += inst;
            cfs.Add(-inst);

            fund += fund * monthlyFundReturn;
            if (m == input.BankBlockedDepositDurationMonths && input.DeductBankChargesFromLoanProceeds)
            {
                fund += bankBlocked;
            }

            decimal netSurrender = Math.Max(0, fund - loan);
            if (!be.HasValue && netSurrender >= paid)
            {
                be = m;
            }

            if (m == 60)
            {
                p5 = netSurrender - paid;
            }
            if (m == 120)
            {
                p10 = netSurrender - paid;
                decimal df = (decimal)Math.Pow(1.0 + (double)monthlyInf, -120);
                r10 = netSurrender * df;
                cfs[cfs.Count - 1] += netSurrender;
            }
        }

        decimal irr = CalculateMonthlyIRR(cfs);
        return (be, p5, p10, r10, irr);
    }

    private decimal CalculateMonthlyIRR(List<decimal> cashFlows)
    {
        if (cashFlows.Count < 2) return 0m;
        // بررسی وجود تغییر علامت
        bool hasPositive = cashFlows.Any(c => c > 0);
        bool hasNegative = cashFlows.Any(c => c < 0);
        if (!hasPositive || !hasNegative) return 0m;

        // الگوریتم دو بخشی (Bisection) برای پیدا کردن نرخ ماهانه
        double low = -0.5;
        double high = 1.0;
        double tolerance = 1e-6;

        Func<double, double> npv = (rate) =>
        {
            double sum = 0;
            for (int t = 0; t < cashFlows.Count; t++)
            {
                sum += (double)cashFlows[t] / Math.Pow(1.0 + rate, t);
            }
            return sum;
        };

        double npvLow = npv(low);
        double npvHigh = npv(high);

        if (npvLow * npvHigh > 0)
        {
            // تقریب ساده در صورت عدم همگرایی در این بازه
            return 0.25m;
        }

        for (int iter = 0; iter < 100; iter++)
        {
            double mid = (low + high) / 2.0;
            double npvMid = npv(mid);

            if (Math.Abs(npvMid) < tolerance || (high - low) / 2.0 < tolerance)
            {
                // تبدیل نرخ ماهانه به سالانه مرکب
                double annualRate = Math.Pow(1.0 + mid, 12.0) - 1.0;
                return (decimal)Math.Round(annualRate, 4);
            }

            if (npvLow * npvMid <= 0)
            {
                high = mid;
                npvHigh = npvMid;
            }
            else
            {
                low = mid;
                npvLow = npvMid;
            }
        }

        double finalMid = (low + high) / 2.0;
        return (decimal)Math.Round(Math.Pow(1.0 + finalMid, 12.0) - 1.0, 4);
    }

    private decimal EstimateAnnualMortalityRate(int age)
    {
        // جدول مرگ‌ومیر تقریب زده‌شده TD88-90 / CSO (مرگ و میر در ۱۰۰۰ نفر)
        if (age < 30) return 0.0012m;
        if (age < 40) return 0.0020m;
        if (age < 50) return 0.0045m;
        if (age < 60) return 0.0095m;
        return 0.0180m;
    }

    private CustomerStrategicAnalysis GenerateCustomerStrategicAnalysis(ContractInputModel input, SimulationResultModel result)
    {
        var analysis = new CustomerStrategicAnalysis
        {
            InitialCashOutlay = result.EffectiveCustomerInitialPayment,
            TotalPayments = result.CustomerTotalPayments,
            FinalNominalWealth = result.CustomerFinalNominalFund,
            FinalRealPurchasingPower = result.MonthlySchedule.Last().NetSurrenderValueReal,
            NominalIRR = result.CustomerAnnualIRR,
            RealIRR = result.CustomerRealIRR,
            NominalBreakevenMonth = result.NominalBreakevenMonth,
            RealBreakevenMonth = result.RealBreakevenMonth,
            InitialLeverageRatio = input.CustomerInitialCash > 0 ? (input.TotalPolicyValue / input.CustomerInitialCash) : 0m
        };

        // ۱. مزایا و فرصت‌ها (Advantages)
        analysis.Advantages.Add(new StrategicItem
        {
            Title = "اهرم مالی ۲.۵ برابری در نقطه شروع (Financial Leverage)",
            Category = "تأمین مالی و سرمایه‌گذاری",
            ImpactLevel = "بسیار بالا",
            MonetaryValue = input.BankLoanAmount,
            Description = $"مشتری با پرداخت تنها {input.CustomerInitialCash:N0} تومان آورده نقدی، از طریق وام {input.BankLoanAmount:N0} تومانی بانک، صاحب یک سرمایه‌گذاری {input.TotalPolicyValue:N0} تومانی می‌شود که بازدهی مرکب آن از روز اول روی کل سرمایه محاسبه می‌گردد."
        });

        analysis.Advantages.Add(new StrategicItem
        {
            Title = "دریافت تسهیلات بانکی بدون نیاز به ضامن و وثیقه ملکی",
            Category = "سهولت اعتباری",
            ImpactLevel = "بالا",
            Description = "تسهیلات بانکی با وثیقه‌گذاری خود بیمه‌نامه و تعهد رسمی شرکت بیمه پرداخت می‌شود و بیمه‌گذار نیازی به معرفی ضامن کارمند، چک تضمین یا وثیقه‌گذاری ملکی ندارد."
        });

        analysis.Advantages.Add(new StrategicItem
        {
            Title = "پوشش حمایتی بیمه عمر و تسویه خودکار وام در صورت فوت",
            Category = "امنیت خانواده و پوشش بیمه‌ای",
            ImpactLevel = "بسیار بالا",
            MonetaryValue = input.LifeCoverageCapital,
            Description = $"در صورت فوت ناگهانی، خانواده علاوه بر دریافت سرمایه فوت {input.LifeCoverageCapital:N0} تومانی و اندوخته خالص، از بازپرداخت اقساط وام معاف بوده و مانده بدهی مستقیماً توسط بیمه با بانک تسویه می‌شود."
        });

        analysis.Advantages.Add(new StrategicItem
        {
            Title = "سود مرکب بلندمدت و انباشت ثروت بازنشستگی",
            Category = "رشد دارایی",
            ImpactLevel = "بالا",
            MonetaryValue = result.CustomerNominalGain,
            Description = $"با تسویه اقساط در ماه {input.BankLoanTenureMonths}، کل اندوخته صندوق به صورت تصاعدی رشد کرده و ثروت اسمی نهایی به {result.CustomerFinalNominalFund:N0} تومان می‌رسد که سودی معادل {result.CustomerNominalGain:N0} تومان را رقم می‌زند."
        });

        // ۲. معایب، ریسک‌ها و چالش‌ها (Disadvantages & Risks)
        analysis.DisadvantagesAndRisks.Add(new StrategicItem
        {
            Title = "فشار نقدینگی اقساط ماهانه در ۲ سال اول",
            Category = "جریان نقدی و تعهد ماهانه",
            ImpactLevel = "بالا",
            MonetaryValue = result.MonthlyInstallment,
            Description = $"بیمه‌گذار موظف به پرداخت ماهانه {result.MonthlyInstallment:N0} تومان قسط وام به مدت {input.BankLoanTenureMonths} ماه است که عدم پرداخت به‌موقع، مشمول جریمه دیرکرد بانکی خواهد شد."
        });

        analysis.DisadvantagesAndRisks.Add(new StrategicItem
        {
            Title = "زیان مالی در صورت انصراف و بازخرید پیش از موعد در ۲۴ ماه نخست",
            Category = "نقدشوندگی و دوره بازگشت",
            ImpactLevel = "بحرانی",
            Description = $"در ماه‌های ابتدایی به دلیل کسر کارمزدهای اولیه بیمه و بانک، ارزش بازخرید کمتر از مجموع پرداختی‌هاست. نقطه سربه‌سر اسمی در ماه {(result.NominalBreakevenMonth.HasValue ? result.NominalBreakevenMonth.Value.ToString() : "نامشخص")} رخ می‌دهد."
        });

        if (input.AnnualInflationRate > input.FundAnnualReturnRate)
        {
            analysis.DisadvantagesAndRisks.Add(new StrategicItem
            {
                Title = "افت قدرت خرید واقعی ناشی از تورم فراتر از بازده صندوق",
                Category = "ریسک اقتصاد کلان و تورم",
                ImpactLevel = "بسیار بالا",
                Description = $"نرخ تورم سالانه ({input.AnnualInflationRate * 100:N0}٪) از نرخ بازده پیش‌بینی‌شده صندوق ({input.FundAnnualReturnRate * 100:N0}٪) بیشتر است. این شکاف تورمی باعث می‌شود بازده واقعی تعدیل‌شده با تورم کاهش یابد."
            });
        }

        // ۳. هشدارهای فعال (Active Warnings)
        if (result.NominalBreakevenMonth > 24)
        {
            analysis.CriticalWarnings.Add($"دوره سربه‌سر اسمی ({result.NominalBreakevenMonth} ماه) طولانی‌تر از دوره بازپرداخت وام است؛ بنابراین سودآوری بیمه‌گذار پس از تسویه کامل اقساط آغاز می‌گردد.");
        }
        if (result.CustomerRealIRR < 0)
        {
            analysis.CriticalWarnings.Add($"بازده داخلی واقعی پس از تورم ({result.CustomerRealIRR * 100:N1}٪) منفی است؛ این طرح در شرایط تورم افسارگسیخته فعلی بیشتر نقش پوشش خطر فوت و پس‌انداز انضباطی را دارد تا سوداگری.");
        }
        if (result.MonthlyInstallment > (input.CustomerInitialCash * 0.15m))
        {
            analysis.CriticalWarnings.Add($"قسط ماهانه ({result.MonthlyInstallment:N0} تومان) قابل‌توجه است؛ بیمه‌گذار باید از استطاعت مالی خود برای پرداخت ماهانه منظم اطمینان یابد.");
        }

        // ۴. توصیه‌های استراتژیک (Recommendations)
        analysis.StrategicRecommendations.Add("پرهیز از بازخرید زودهنگام بیمه‌نامه حداقل تا قبل از سال ۳ جهت عبور ایمن از دوره بازگشت سرمایه.");
        analysis.StrategicRecommendations.Add("اتصال حساب واریز حقوق یا حساب فعال نزد بانک برای پرداخت خودکار اقساط بدون دیرکرد.");
        analysis.StrategicRecommendations.Add("استفاده از سبدهای دارایی پربازده‌تر (مانند صندوق‌های سهامی یا طلا) در شرایط تورم بالای ۴۰ درصد.");

        return analysis;
    }

    private BankStrategicAnalysis GenerateBankStrategicAnalysis(ContractInputModel input, SimulationResultModel result)
    {
        var analysis = new BankStrategicAnalysis
        {
            LoanPrincipalGranted = input.BankLoanAmount,
            UpfrontFeeCollected = result.BankFeeAmount,
            BlockedDepositBenefit = result.Stakeholders.BankBlockedDepositBenefit,
            TotalInterestRevenue = result.TotalLoanInterestAmount,
            TotalGrossRevenue = result.Stakeholders.BankTotalGrossRevenue,
            EffectiveAnnualYieldAPR = result.BankEffectiveAPR,
            DefaultRiskRate = 0m,
            CollateralCoverageRatioAtStart = input.BankLoanAmount > 0 ? (result.NetInitialFundDeposit / input.BankLoanAmount) * 100m : 100m
        };

        // ۱. مزایا و فرصت‌ها (Advantages)
        analysis.Advantages.Add(new StrategicItem
        {
            Title = "ریسک اعتباری و سوخت تسهیلات صفر درصد (Zero NPL Risk)",
            Category = "مدیریت ریسک اعتباری",
            ImpactLevel = "بسیار بالا",
            MonetaryValue = input.BankLoanAmount,
            Description = $"به دلیل توثیق رسمی اندوخته صندوق سرمایه‌گذاری و تعهد پرداخت قطعی شرکت بیمه در صورت فوت یا انصراف، وام {input.BankLoanAmount:N0} تومانی بانک هرگز در معرض سوخت یا مطالبات مشکوک‌الوصول قرار ندارد."
        });

        analysis.Advantages.Add(new StrategicItem
        {
            Title = "کارمزد نقدی قطعی در بدو اعطا (Upfront Cash Fee)",
            Category = "درآمد غیرمشاع نقدی",
            ImpactLevel = "بالا",
            MonetaryValue = result.BankFeeAmount,
            Description = $"بانک در همان لحظه صدور تسهیلات مبلغ {result.BankFeeAmount:N0} تومان (معادل {input.BankFeeRate * 100:N1}٪ اصل وام) را به عنوان کارمزد پرونده به صورت نقدی دریافت و به عنوان سود قطعی شناسایی می‌کند."
        });

        analysis.Advantages.Add(new StrategicItem
        {
            Title = "رسوب رایگان سپرده مسدود نقدی برای مدت ۱۲ ماه",
            Category = "تجهیز منابع ارزان‌قیمت",
            ImpactLevel = "بالا",
            MonetaryValue = result.BankBlockedDepositAmount,
            Description = $"مبلغ {result.BankBlockedDepositAmount:N0} تومان (۴٪ وام) به مدت یک سال در حساب بانک بلوکه مانده و ارزش هزینه‌فرصت آن معادل {analysis.BlockedDepositBenefit:N0} تومان منفعت ترازنامه‌ای برای بانک ایجاد می‌نماید."
        });

        analysis.Advantages.Add(new StrategicItem
        {
            Title = "بازده مؤثر سالانه بالا (Effective APR)",
            Category = "سودآوری تسهیلات",
            ImpactLevel = "بسیار بالا",
            Description = $"با احتساب کارمزد اولیه، سود تسهیلات {input.BankLoanAnnualInterestRate * 100:N0}٪ و رسوب سپرده مسدود، نرخ بازده مؤثر تسهیلات برای بانک به {analysis.EffectiveAnnualYieldAPR * 100:N1}٪ سالانه می‌رسد که فراتر از نرخ مصوب اسمی است."
        });

        analysis.Advantages.Add(new StrategicItem
        {
            Title = "جذب مشتریان وفادار جدید و رسوب اقساط در شبکه بانکی (Cross-selling)",
            Category = "توسعه کسب‌وکار بانکی",
            ImpactLevel = "متوسط",
            Description = "هر فقره بیمه‌نامه منجر به افتتاح حساب جدید، الزام به واریز ۲۴ مرحله قسط و فرصت فروش سایر خدمات بانک نظیر کارت اعتباری، اینترنت بانک و سپرده‌گذاری می‌گردد."
        });

        // ۲. معایب، ریسک‌ها و چالش‌ها (Disadvantages & Risks)
        analysis.DisadvantagesAndRisks.Add(new StrategicItem
        {
            Title = "ریسک عملیاتی و حقوقی در فرآیند استرداد و تسویه با شرکت بیمه",
            Category = "ریسک عملیاتی و حقوقی",
            ImpactLevel = "متوسط",
            Description = "در صورت نکول اقساط، تسویه بدهی با بیمه‌گر نیازمند اعلام رسمی، فسخ بیمه‌نامه و انتقال وجه از صندوق به بانک است که در صورت عدم اتصال خودکار سامانه‌ها می‌تواند با تأخیر همراه شود."
        });

        analysis.DisadvantagesAndRisks.Add(new StrategicItem
        {
            Title = "قفل خط اعتباری و سهمیه تسهیلات خرد بانک با نرخ مصوب ۲۳٪",
            Category = "مدیریت نقدینگی و منابع",
            ImpactLevel = "متوسط",
            MonetaryValue = input.BankLoanAmount,
            Description = "تخصیص خط اعتباری به این طرح بخشی از سهمیه تسهیلات خرد شعبه را اشغال می‌کند که در دوران انقباض پولی بانک مرکزی ممکن است با محدودیت سقف تسهیلات‌دهی روبرو شود."
        });

        // ۳. هشدارهای فعال (Active Warnings)
        if (input.BankFeeRate < 0.05m)
        {
            analysis.CriticalWarnings.Add($"کارمزد بانکی ({input.BankFeeRate * 100:N1}٪) کمتر از نرخ بهینه عرف ۵ الی ۶.۵ درصد تنظیم شده است که بازده مؤثر بانک را کاهش می‌دهد.");
        }
        if (input.BankLoanTenureMonths > 36)
        {
            analysis.CriticalWarnings.Add($"دوره بازپرداخت ({input.BankLoanTenureMonths} ماه) طولانی‌تر از استاندارد ۳۶ ماه است که هزینه فرصت منابع بانک را در شرایط تورمی افزایش می‌دهد.");
        }

        // ۴. توصیه‌های استراتژیک (Recommendations)
        analysis.StrategicRecommendations.Add("برقراری وب‌سرویس API برخط بین سامانه اعتبارات بانک و سامانه صدور شرکت بیمه جهت وثیقه‌گذاری آنی.");
        analysis.StrategicRecommendations.Add("اخذ وکالت بلاعزل برداشت مستقیم اقساط (Direct Debit) از حساب جاری/حقوق مشتری.");
        analysis.StrategicRecommendations.Add("ارائه بسته‌های تشویقی کارمزد برای مشتریانی که اقساط را زودتر از موعد یا بدون تاخیر تسویه می‌کنند.");

        return analysis;
    }

    private InsuranceStrategicAnalysis GenerateInsuranceStrategicAnalysis(ContractInputModel input, SimulationResultModel result)
    {
        var analysis = new InsuranceStrategicAnalysis();

        // شاخص‌های مالی و سودآوری بیمه‌گر
        analysis.UpfrontCashInflow = input.TotalPolicyValue;
        analysis.ImmediateRiskFreeProfit = result.InsuranceUnderwritingFeeAmount; // ۵٪ بیمه‌گری
        analysis.LongTermManagementFees = result.Stakeholders.InsuranceFundManagementIncome;
        analysis.TotalExpectedRevenue = result.Stakeholders.InsuranceUnderwritingIncome + 
                                       result.Stakeholders.InsuranceMortalityCoverageIncome + 
                                       result.Stakeholders.InsuranceFundManagementIncome;
        analysis.NetProfitAfterClaimsAndExpenses = result.Stakeholders.InsuranceNetMargin;
        analysis.ProfitMarginPercentage = analysis.TotalExpectedRevenue > 0 
            ? (analysis.NetProfitAfterClaimsAndExpenses / analysis.TotalExpectedRevenue) * 100m 
            : 0m;

        // تحلیل وثیقه و تعهد تسویه به بانک
        int coverageMonth = 0;
        decimal maxExposure = 0m;
        int maxExposureMonth = 0;

        for (int m = 1; m <= result.MonthlySchedule.Count; m++)
        {
            var item = result.MonthlySchedule[m - 1];
            decimal netGap = item.RemainingLoanBalance - item.FundValueEnding; // اگر مثبت باشد، بدهی از صندوق بیشتر است
            if (netGap > maxExposure)
            {
                maxExposure = netGap;
                maxExposureMonth = m;
            }

            if (coverageMonth == 0 && item.FundValueEnding >= item.RemainingLoanBalance)
            {
                coverageMonth = m;
            }
        }

        analysis.MonthsToFullCollateralCoverage = coverageMonth;
        analysis.MaximumDefaultExposure = Math.Max(0, maxExposure);
        analysis.MonthOfMaxExposure = maxExposureMonth;

        var y1Item = result.MonthlySchedule.FirstOrDefault(m => m.Month == 12);
        analysis.Year1CoverageRatio = (y1Item != null && y1Item.RemainingLoanBalance > 0)
            ? (y1Item.FundValueEnding / y1Item.RemainingLoanBalance) * 100m
            : 100m;

        // تحلیل اکچوئری ریسک فوت
        analysis.AnnualMortalityRate = EstimateAnnualMortalityRate(input.InsuredAge);
        analysis.CumulativeMortalityProbability = 1.0m - (decimal)Math.Pow(1.0 - (double)analysis.AnnualMortalityRate, input.SimulationYears);
        analysis.TotalMortalityPremiumCollected = result.LifeCoverageFeeAmount;
        analysis.ExpectedMortalityClaimCost = result.Stakeholders.InsuranceExpectedClaimExpense;
        analysis.MortalityUnderwritingResult = analysis.TotalMortalityPremiumCollected - analysis.ExpectedMortalityClaimCost;

        // مزایای استراتژیک (Advantages / Pros)
        analysis.Advantages.Add(new StrategicItem
        {
            Title = "جذب نقدینگی و حق بیمه کلان در بدو قرارداد (Upfront Cash Inflow)",
            Category = "توسعه بازار و پورتفو",
            ImpactLevel = "بسیار بالا",
            MonetaryValue = input.TotalPolicyValue,
            Description = $"شرکت بیمه در همان ابتدای قرارداد مبلغ {input.TotalPolicyValue:N0} تومان حق بیمه را از ترکیب نقد و وام بانکی تجهیز و وصول می‌کند که برای افزایش سهم بازار بیمه‌های زندگی و ارتقای رتبه توانگری مالی شرکت در صنعت بیمه بسیار اثرگذار است."
        });

        analysis.Advantages.Add(new StrategicItem
        {
            Title = "کارمزد بیمه‌گری قطعی و بدون ریسک در نقطه صفر",
            Category = "سودآوری مالی",
            ImpactLevel = "بالا",
            MonetaryValue = result.InsuranceUnderwritingFeeAmount,
            Description = $"مبلغ {result.InsuranceUnderwritingFeeAmount:N0} تومان (۵٪ کل حق بیمه) بلافاصله پس از صدور به عنوان درآمد قطعی و کارمزد بیمه‌گری برداشت می‌شود که مستقیماً به سود عملیاتی شرکت افزوده می‌گردد."
        });

        analysis.Advantages.Add(new StrategicItem
        {
            Title = "کاهش چشمگیر هزینه جذب مشتری (Low CAC) از طریق کانال بانک",
            Category = "بازاریابی و توزیع",
            ImpactLevel = "بالا",
            Description = "استفاده از شبکه گسترده شعب بانک و بستر Bancassurance هزینه‌های سرسام‌آور بازاریابی، تبلیغات محیطی و پورسانت‌های سنگین شبکه سنتی نمایندگان را به حداقل ممکن می‌رساند."
        });

        analysis.Advantages.Add(new StrategicItem
        {
            Title = "درآمد مستمر از محل کارمزد مدیریت سبد سرمایه‌گذاری (AUM Fees)",
            Category = "جریان درآمدی پایدار",
            ImpactLevel = "متوسط",
            MonetaryValue = analysis.LongTermManagementFees,
            Description = $"با رشد مرکب صندوق سرمایه‌گذاری در طول {input.SimulationYears} سال، کارمزد مدیریت سبد دارایی درآمدی مستمر معادل حدود {analysis.LongTermManagementFees:N0} تومان برای شرکت ایجاد می‌کند."
        });

        if (analysis.MortalityUnderwritingResult >= 0)
        {
            analysis.Advantages.Add(new StrategicItem
            {
                Title = "مازاد فنی مثبت در بخش پوشش فوت (Underwriting Profit)",
                Category = "اکچوئری",
                ImpactLevel = "متوسط",
                MonetaryValue = analysis.MortalityUnderwritingResult,
                Description = $"حق بیمه پوشش فوت دریافتی ({analysis.TotalMortalityPremiumCollected:N0} تومان) از ارزش انتظاری ریاضی خسارت فوت ({analysis.ExpectedMortalityClaimCost:N0} تومان) بیشتر است و مازاد سود فنی {analysis.MortalityUnderwritingResult:N0} تومان برای بیمه‌گر باقی می‌گذارد."
            });
        }

        // معایب و ریسک‌های استراتژیک (Disadvantages & Risks)
        if (analysis.MaximumDefaultExposure > 0)
        {
            analysis.DisadvantagesAndRisks.Add(new StrategicItem
            {
                Title = "ریسک کسری وثیقه در صورت نکول بیمه‌گذار در ماه‌های ابتدایی",
                Category = "ریسک اعتباری و تعهدات",
                ImpactLevel = "بحرانی",
                MonetaryValue = analysis.MaximumDefaultExposure,
                Description = $"در ماه {analysis.MonthOfMaxExposure}، مانده بدهی به بانک بیشتر از ارزش روز صندوق است و حداکثر شکاف کسری معادل {analysis.MaximumDefaultExposure:N0} تومان خواهد بود. اگر بیمه‌گذار اقساط را متوقف کند، بیمه‌گر متعهد به تأمین این کسری خواهد بود."
            });
        }
        else
        {
            analysis.DisadvantagesAndRisks.Add(new StrategicItem
            {
                Title = "تعهد حقوقی به بانک جهت تسویه مانده تسهیلات (Guarantor Role)",
                Category = "ریسک حقوقی و اعتباری",
                ImpactLevel = "متوسط",
                Description = "شرکت بیمه در برابر بانک متعهد است که در صورت هرگونه عدم وصول اقساط، مانده تسهیلات را از محل اندوخته تسویه کند. هرچند ارزش صندوق وام را پوشش می‌دهد، اما فرآیند اداری و بلوکه شدن نقدینگی بر عهده بیمه است."
            });
        }

        analysis.DisadvantagesAndRisks.Add(new StrategicItem
        {
            Title = "ریسک فسخ زودهنگام و بازخرید (Early Surrender / Lapse Risk)",
            Category = "ریسک پایداری بیمه‌نامه",
            ImpactLevel = "بالا",
            Description = "به دلیل کسر کارمزد ۶.۵٪ بانک، ۵٪ بیمه‌گری و ۵٪ پوشش فوت، ارزش بازخرید خالص تا ماه " + (result.NominalBreakevenMonth.HasValue ? result.NominalBreakevenMonth.Value.ToString() : "۲۴") + " به نقطه سربه‌سر نمی‌رسد. انصراف زودهنگام بیمه‌گذار موجب نارضایتی مشتری و چالش تسویه تسهیلات با بانک خواهد شد."
        });

        if (input.AnnualInflationRate >= 0.35m)
        {
            analysis.DisadvantagesAndRisks.Add(new StrategicItem
            {
                Title = "ریسک فرسایش ارزش واقعی اندوخته ناشی از تورم بالا و آسیب به برند",
                Category = "ریسک اعتبار برند و ALM",
                ImpactLevel = "بالا",
                Description = $"با تورم سالانه {input.AnnualInflationRate * 100:N0}٪، اگر بازدهی صندوق نتواند تورم را پوشش دهد، قدرت خرید اندوخته افت شدیدی پیدا می‌کند و بیمه‌گذاران در سال‌های میانی احساس زیان کرده و اقدام به بازخرید یا پیگیری قضایی می‌کنند."
            });
        }

        if (analysis.MortalityUnderwritingResult < 0)
        {
            analysis.DisadvantagesAndRisks.Add(new StrategicItem
            {
                Title = "کسری حق بیمه پوشش فوت نسبت به ریسک اکچوئری (سن بالا)",
                Category = "ریسک اکچوئری",
                ImpactLevel = "بحرانی",
                MonetaryValue = Math.Abs(analysis.MortalityUnderwritingResult),
                Description = $"در سن {input.InsuredAge} سالگی و افق {input.SimulationYears} ساله، ارزش ریاضی خسارت انتظاری فوت ({analysis.ExpectedMortalityClaimCost:N0} تومان) از حق بیمه ۵٪ دریافتی پیشی گرفته و موجب زیان فنی {Math.Abs(analysis.MortalityUnderwritingResult):N0} تومان می‌شود."
            });
        }

        analysis.DisadvantagesAndRisks.Add(new StrategicItem
        {
            Title = "تعهدات ذخیره‌گیری فنی و اکچوئری نزد بیمه مرکزی",
            Category = "الزامات رگولاتوری",
            ImpactLevel = "متوسط",
            Description = "شرکت بیمه موظف است طبق آیین‌نامه‌های مصوب بیمه مرکزی ج.ا.ا، ذخایر ریاضی، بازخرید و خسارت معوق معتنابهی را در صورت‌های مالی قفل و نگهداری کند که بر نقدینگی کوتاه‌مدت شرکت اثر می‌گذارد."
        });

        // هشدارهای هوشمند و فعال (Critical Warnings)
        if (input.InsuredAge >= 50)
        {
            analysis.CriticalWarnings.Add($"هشدار اکچوئری: سن بیمه‌گذار ({input.InsuredAge} سال) بالاست؛ در این سنین، احتمال فوت افزایش یافته و تعهد پرداخت {input.LifeCoverageCapital:N0} تومان با حق بیمه ۵٪ توجیه فنی ندارد. اخذ پرسشنامه پزشکی و اضافه نرخ سنی الزامی است.");
        }

        if (input.FundAnnualReturnRate < input.BankLoanAnnualInterestRate)
        {
            analysis.CriticalWarnings.Add($"هشدار خطر منفی شدن بازده: بازده پیش‌بینی صندوق ({input.FundAnnualReturnRate * 100:N0}٪) کمتر از سود تسهیلات بانکی ({input.BankLoanAnnualInterestRate * 100:N0}٪) است. این موضوع موجب ذوب شدن سریع اندوخته و افزایش شدید ریسک نکول مشتری می‌شود.");
        }

        if (input.AgentCommissionRate > 0.03m)
        {
            analysis.CriticalWarnings.Add($"هشدار کارمزد شبکه فروش: کارمزد نماینده ({input.AgentCommissionRate * 100:N1}٪) بسیار بالاست. در مدل‌های بانکی (Bancassurance) به دلیل استفاده از شعب بانک، کارمزد فروشنده معمولاً زیر ۱.۵٪ تنظیم می‌شود تا از جذابیت صندوق برای مشتری کاسته نشود.");
        }

        if (analysis.Year1CoverageRatio < 100m)
        {
            analysis.CriticalWarnings.Add($"هشدار عدم کفایت وثیقه در سال اول: نسبت پوشش اندوخته به مانده بدهی وام در پایان سال اول {analysis.Year1CoverageRatio:N1}٪ است (کمتر از ۱۰۰٪)؛ یعنی در صورت نکول مشتری در سال اول، شرکت بیمه باید کسری را پرداخت کند.");
        }

        // توصیه‌های استراتژیک (Strategic Recommendations)
        analysis.StrategicRecommendations.Add("تنظیم شرط حداقل ماندگاری ۲ ساله: تعیین جریمه بازخرید در صورت انصراف در ۲ سال اول تا هزینه‌های بانکی و بیمه‌گری مستهلک شود.");
        analysis.StrategicRecommendations.Add("الزام سقف سنی ۵۰ سال برای پوشش فوت بدون معاینه پزشکی جهت مهار ریسک گزینش نامساعد.");
        analysis.StrategicRecommendations.Add("تضمین حداقل بازده تضمینی صندوق یا استفاده از صندوق‌های با درآمد ثابت و اهرمی معتبر برای پیشگیری از نوسانات منفی شدید.");
        analysis.StrategicRecommendations.Add("مذاکره با بانک برای تسهیم بخشی از کارمزد ۶.۵٪ بانک با شرکت بیمه به پاس ضمانت بازپرداخت اقساط توسط بیمه‌گر.");

        return analysis;
    }
}

