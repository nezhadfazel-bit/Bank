namespace BancassuranceSim.Web.Models;

public class ContractInputModel
{
    // ۱. ارزش پایه بیمه‌نامه
    public decimal TotalPolicyValue { get; set; } = 100_000_000m; // ۱۰۰ میلیون تومان

    // ۲. آورده نقدی بیمه‌گذار
    public decimal CustomerInitialCash { get; set; } = 40_000_000m; // ۴۰ میلیون تومان

    // ۳. تسهیلات بانکی
    public decimal BankLoanAmount { get; set; } = 60_000_000m; // ۶۰ میلیون تومان
    public decimal BankFeeRate { get; set; } = 0.065m; // ۶.۵ درصد کارمزد بانک
    public decimal BankBlockedDepositRate { get; set; } = 0.04m; // ۴ درصد سپرده مسدود شده
    public int BankBlockedDepositDurationMonths { get; set; } = 12; // مدت مسدودی ۱۲ ماه
    public decimal BankLoanAnnualInterestRate { get; set; } = 0.23m; // نرخ سود سالانه تسهیلات (مثلاً ۲۳٪)
    public int BankLoanTenureMonths { get; set; } = 24; // مدت بازپرداخت اقساط به ماه (مثلا ۲۴ ماه)
    public bool DeductBankChargesFromLoanProceeds { get; set; } = true; // آیا کارمزد و مسدودی از مبلغ وام واریزی کسر شود؟

    // ۴. هزینه‌های شرکت بیمه
    public decimal InsuranceUnderwritingFeeRate { get; set; } = 0.05m; // ۵ درصد هزینه بیمه‌گری
    public decimal LifeCoverageFeeRate { get; set; } = 0.05m; // ۵ درصد حق بیمه پوشش فوت
    public decimal LifeCoverageCapital { get; set; } = 100_000_000m; // سرمایه فوت پایه (۱۰۰ میلیون تومان)
    public decimal AgentCommissionRate { get; set; } = 0.02m; // ۲ درصد کارمزد نماینده
    public bool AgentCommissionFromCustomer { get; set; } = true; // کسر از سهم بیمه‌گذار

    // ۵. پارامترهای صندوق سرمایه‌گذاری و کلان اقتصادی
    public decimal FundAnnualReturnRate { get; set; } = 0.30m; // نرخ بازده سالانه پیش‌بینی صندوق (مثلاً ۳۰٪)
    public decimal AnnualInflationRate { get; set; } = 0.40m; // نرخ تورم سالانه در ایران (مثلاً ۴۰٪)
    public int SimulationYears { get; set; } = 10; // افق زمانی تحلیل (سال)
    public int InsuredAge { get; set; } = 35; // سن بیمه‌گذار برای برآورد ریسک فوت
}
