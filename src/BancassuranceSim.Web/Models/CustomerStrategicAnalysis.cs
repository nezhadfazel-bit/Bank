namespace BancassuranceSim.Web.Models;

public class CustomerStrategicAnalysis
{
    // ۱. شاخص‌های کمی و مالی مشتری
    public decimal InitialCashOutlay { get; set; } // آورده نقدی اولیه (۴۰ م)
    public decimal TotalPayments { get; set; } // کل پرداختی نقدی + اقساط
    public decimal FinalNominalWealth { get; set; } // ارزش اسمی دارایی در پایان دوره
    public decimal FinalRealPurchasingPower { get; set; } // ارزش واقعی (قدرت خرید روز) با تعدیل تورم
    public decimal NominalIRR { get; set; } // بازده داخلی اسمی
    public decimal RealIRR { get; set; } // بازده واقعی پس از تورم
    public int? NominalBreakevenMonth { get; set; } // ماه سربه‌سر اسمی
    public int? RealBreakevenMonth { get; set; } // ماه سربه‌سر تعدیل‌شده با تورم
    public decimal InitialLeverageRatio { get; set; } // نسبت اهرم مالی اولیه (ارزش بیمه‌نامه به آورده نقد)

    // ۲. مزایا و فرصت‌ها از زاویه بیمه‌گذار
    public List<StrategicItem> Advantages { get; set; } = new();

    // ۳. معایب، ریسک‌ها و چالش‌ها از زاویه بیمه‌گذار
    public List<StrategicItem> DisadvantagesAndRisks { get; set; } = new();

    // ۴. هشدارهای فعال و نکات حیاتی برای بیمه‌گذار
    public List<string> CriticalWarnings { get; set; } = new();

    // ۵. توصیه‌های اختصاصی جهت تصمیم‌گیری بهینه بیمه‌گذار
    public List<string> StrategicRecommendations { get; set; } = new();
}
