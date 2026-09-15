namespace BancassuranceSim.Web.Models;

public class BankStrategicAnalysis
{
    // ۱. شاخص‌های مالی و اعتباری بانک سامان
    public decimal LoanPrincipalGranted { get; set; } // اصل تسهیلات اعطایی (۶۰ م)
    public decimal UpfrontFeeCollected { get; set; } // کارمزد نقدی در بدو پرداخت (۶.۵٪)
    public decimal BlockedDepositBenefit { get; set; } // ارزش رسوب سپرده مسدود ۴٪ به مدت ۱ سال
    public decimal TotalInterestRevenue { get; set; } // کل سود تسهیلات در دوره وام
    public decimal TotalGrossRevenue { get; set; } // مجموع عایدات ناخالص بانک
    public decimal EffectiveAnnualYieldAPR { get; set; } // نرخ بازده مؤثر سالانه تسهیلات (APR)
    public decimal DefaultRiskRate { get; set; } = 0m; // ریسک اعتباری و نکول (صفر درصد)
    public decimal CollateralCoverageRatioAtStart { get; set; } // نسبت وثیقه به بدهی در نقطه شروع

    // ۲. مزایا و فرصت‌ها از زاویه بانک سامان
    public List<StrategicItem> Advantages { get; set; } = new();

    // ۳. معایب، ریسک‌ها و چالش‌ها از زاویه بانک سامان
    public List<StrategicItem> DisadvantagesAndRisks { get; set; } = new();

    // ۴. هشدارهای فعال و خطرات اعتباری/عملیاتی بانک
    public List<string> CriticalWarnings { get; set; } = new();

    // ۵. توصیه‌های عملیاتی و حقوقی برای معاونت اعتبارات بانک سامان
    public List<string> StrategicRecommendations { get; set; } = new();
}
