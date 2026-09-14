namespace BancassuranceSim.Web.Models;

public class MortalityScenarioItem
{
    public int Year { get; set; }
    public decimal LifeInsuranceBenefit { get; set; } // سرمایه فوت پرداختی توسط بیمه
    public decimal AccumulatedFundValue { get; set; } // اندوخته موجود در صندوق
    public decimal RemainingLoanToSettle { get; set; } // مانده بدهی وام که باید به بانک تسویه شود
    public decimal NetPayoutToFamily { get; set; } // خالص دریافتی خانواده بیمه‌گذار
    public decimal TotalPremiumsAndInstallmentsPaid { get; set; } // کل مبالغ پرداختی بیمه‌گذار تا زمان فوت
    public decimal NetBenefitToFamilyRatio { get; set; } // نسبت دریافتی به پرداختی (اهرم بیمه‌ای)
}
