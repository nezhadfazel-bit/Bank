namespace BancassuranceSim.Web.Models;

public class InsuranceStrategicAnalysis
{
    // ۱. شاخص‌های کمی ریسک و عایدی بیمه‌گر
    public decimal UpfrontCashInflow { get; set; } // کل جذب نقدی در شروع (۱۰۰ میلیون تومان حق بیمه ناخالص)
    public decimal ImmediateRiskFreeProfit { get; set; } // سود قطعی بدون ریسک بیمه‌گری (۵٪)
    public decimal LongTermManagementFees { get; set; } // کارمزد بلندمدت مدیریت دارایی صندوق
    public decimal TotalExpectedRevenue { get; set; } // کل درآمدهای بالقوه
    public decimal NetProfitAfterClaimsAndExpenses { get; set; } // سود خالص پس از کسر خسارت و کارمزد نماینده
    public decimal ProfitMarginPercentage { get; set; } // حاشیه سود درصدی

    // ۲. تحلیل ریسک تعهد پرداخت به بانک (Collateral Coverage & Bank Liability)
    public int MonthsToFullCollateralCoverage { get; set; } // چند ماه طول می‌کشد تا اندوخته صندوق از بدهی وام بیشتر شود؟
    public decimal MaximumDefaultExposure { get; set; } // حداکثر زیان احتمالی در صورت نکول بیمه‌گذار در بدترین مقطع
    public int MonthOfMaxExposure { get; set; } // ماهی که ریسک نکول برای بیمه در اوج است
    public decimal Year1CoverageRatio { get; set; } // نسبت پوشش اندوخته به وام در پایان سال اول (درصد)

    // ۳. تحلیل ریسک فوت و اکچوئری (Mortality Risk)
    public decimal AnnualMortalityRate { get; set; } // نرخ مرگ و میر سالانه متناسب با سن
    public decimal CumulativeMortalityProbability { get; set; } // احتمال تجمیعی فوت در طول دوره
    public decimal TotalMortalityPremiumCollected { get; set; } // حق بیمه فوت وصول شده
    public decimal ExpectedMortalityClaimCost { get; set; } // ارزش ریاضی خسارت انتظاری
    public decimal MortalityUnderwritingResult { get; set; } // سود یا زیان بخش فوت (حق بیمه منهای خسارت انتظاری)

    // ۴. فهرست تحلیلی مزایا (Pros) با ارقام پویا
    public List<StrategicItem> Advantages { get; set; } = new();

    // ۵. فهرست تحلیلی معایب و ریسک‌ها (Cons / Risks) با ارقام پویا
    public List<StrategicItem> DisadvantagesAndRisks { get; set; } = new();

    // ۶. هشدارهای فعال و خطرات بحرانی (Active Warnings) بر اساس مقادیر ورودی
    public List<string> CriticalWarnings { get; set; } = new();

    // ۷. توصیه‌های عملیاتی برای هیئت مدیره و اکچوئر شرکت بیمه
    public List<string> StrategicRecommendations { get; set; } = new();
}

public class StrategicItem
{
    public string Title { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public string Category { get; set; } = string.Empty; // مالی، بازاریابی، اکچوئری، اعتباری
    public string ImpactLevel { get; set; } = "High"; // بالا، متوسط، بحرانی
    public decimal? MonetaryValue { get; set; } // در صورت وجود ارزش ریالی
}
