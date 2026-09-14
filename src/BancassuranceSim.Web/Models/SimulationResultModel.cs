namespace BancassuranceSim.Web.Models;

public class SimulationResultModel
{
    // ۱. تفکیک وجوه در نقطه شروع (تراز افتتاحیه)
    public decimal TotalPolicyNominalValue { get; set; }
    public decimal CustomerInitialCash { get; set; }
    public decimal BankLoanAmount { get; set; }
    public decimal BankFeeAmount { get; set; } // ۶.۵٪
    public decimal BankBlockedDepositAmount { get; set; } // ۴٪
    public decimal InsuranceUnderwritingFeeAmount { get; set; } // ۵٪
    public decimal LifeCoverageFeeAmount { get; set; } // ۵٪
    public decimal AgentCommissionAmount { get; set; }
    public decimal NetInitialFundDeposit { get; set; } // مبلغ واریزی خالص به صندوق
    public decimal EffectiveCustomerInitialPayment { get; set; } // کل آورده اولیه نقدی مشتری

    // ۲. مشخصات اقساط وام
    public decimal MonthlyInstallment { get; set; }
    public decimal TotalInstallmentsAmount { get; set; }
    public decimal TotalLoanInterestAmount { get; set; }
    public decimal BankEffectiveAPR { get; set; } // نرخ بهره مؤثر سالانه تسهیلات برای بانک

    // ۳. نتایج نقطه سربه‌سر
    public int? NominalBreakevenMonth { get; set; } // ماه سربه‌سر اسمی
    public int? RealBreakevenMonth { get; set; } // ماه سربه‌سر تعدیل‌شده با تورم
    public string BreakevenStatusMessage { get; set; } = string.Empty;

    // ۴. شاخص‌های کلیدی بازدهی (KPIs)
    public decimal CustomerFinalNominalFund { get; set; }
    public decimal CustomerTotalPayments { get; set; }
    public decimal CustomerNominalGain { get; set; }
    public decimal CustomerRealGain { get; set; }
    public decimal CustomerNominalROI { get; set; }
    public decimal CustomerAnnualIRR { get; set; }
    public decimal CustomerRealIRR { get; set; }

    // ۵. سود و زیان ذی‌نفعان
    public StakeholderPnL Stakeholders { get; set; } = new();

    // ۶. جداول و سناریوها
    public List<MonthlyScheduleItem> MonthlySchedule { get; set; } = new();
    public List<YearlySummaryItem> YearlySummaries { get; set; } = new();
    public List<MortalityScenarioItem> MortalityScenarios { get; set; } = new();
    public List<SensitivityPoint> SensitivityAnalysis { get; set; } = new();

    // ۷. تحلیل استراتژیک، مزایا و ریسک‌های اختصاصی شرکت بیمه
    public InsuranceStrategicAnalysis InsuranceAnalysis { get; set; } = new();
}
