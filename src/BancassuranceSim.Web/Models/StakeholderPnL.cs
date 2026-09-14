namespace BancassuranceSim.Web.Models;

public class StakeholderPnL
{
    // ۱. بیمه‌گذار (مشتری)
    public decimal CustomerTotalOutflows { get; set; } // کل پرداختی نقدی + اقساط
    public decimal CustomerFinalNominalAsset { get; set; } // ارزش نهایی اندوخته منهای بدهی
    public decimal CustomerFinalRealAsset { get; set; } // ارزش واقعی بر اساس قدرت خرید سال اول
    public decimal CustomerNominalNetGain { get; set; } // سود خالص اسمی
    public decimal CustomerRealNetGain { get; set; } // سود خالص واقعی (با کسر تورم)
    public decimal CustomerAnnualizedIRR { get; set; } // نرخ بازده داخلی سالانه اسمی

    // ۲. بانک
    public decimal BankUpfrontFeeIncome { get; set; } // کارمزد ۶.۵٪
    public decimal BankInterestIncome { get; set; } // کل سود دریافتی از اقساط
    public decimal BankBlockedDepositBenefit { get; set; } // سود حاصل از رسوب ۴٪ سپرده مسدود به مدت ۱ سال
    public decimal BankTotalGrossRevenue { get; set; } // مجموع عایدات بانک
    public decimal BankEffectiveAnnualYield { get; set; } // نرخ بازده مؤثر تسهیلات با احتساب کارمزد و مسدودی
    public decimal BankDefaultRiskLevel { get; set; } = 0m; // ریسک نکول عملاً صفر به دلیل وثیقه بودن اندوخته و تضمین بیمه

    // ۳. شرکت بیمه
    public decimal InsuranceUnderwritingIncome { get; set; } // هزینه ۵٪ بیمه‌گری
    public decimal InsuranceMortalityCoverageIncome { get; set; } // سهم پوشش فوت
    public decimal InsuranceFundManagementIncome { get; set; } // کارمزد مدیریت و نگهداری سبد سرمایه‌گذاری
    public decimal InsuranceAgentCommissionExpense { get; set; } // هزینه کارمزد نماینده (در صورت وجود)
    public decimal InsuranceExpectedClaimExpense { get; set; } // ارزش انتظاری خسارت فوت
    public decimal InsuranceNetMargin { get; set; } // حاشیه سود خالص شرکت بیمه
}

public class SensitivityPoint
{
    public decimal FundReturnRate { get; set; }
    public decimal LoanInterestRate { get; set; }
    public decimal InflationRate { get; set; }
    public int? BreakevenMonthNominal { get; set; }
    public decimal Customer5YearProfitNominal { get; set; }
    public decimal Customer10YearProfitNominal { get; set; }
    public decimal Customer10YearRealAsset { get; set; }
    public decimal CustomerIRR { get; set; }
}
