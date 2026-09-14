namespace BancassuranceSim.Web.Models;

public class MonthlyScheduleItem
{
    public int Month { get; set; }
    public int Year => (Month - 1) / 12 + 1;

    // وام بانکی
    public decimal MonthlyInstallment { get; set; }
    public decimal MonthlyPrincipalPaid { get; set; }
    public decimal MonthlyInterestPaid { get; set; }
    public decimal RemainingLoanBalance { get; set; }
    public decimal CumulativeLoanPaid { get; set; }

    // آورده کل مشتری (نقد اولیه + اقساط تا الان + احیانا کارمزدها)
    public decimal CumulativeCustomerOutflow { get; set; }

    // وضعیت صندوق سرمایه‌گذاری
    public decimal FundValueBeginning { get; set; }
    public decimal MonthlyFundReturn { get; set; }
    public decimal FundValueEnding { get; set; }

    // ارزش خالص دارایی بیمه‌گذار (اندوخته صندوق منهای مانده بدهی وام)
    public decimal NetSurrenderValue { get; set; } // ارزش بازخرید خالص

    // سود / زیان اسمی بیمه‌گذار نسبت به کل پول پرداخت‌شده تا این ماه
    public decimal CustomerNominalProfitOrLoss { get; set; }
    public decimal CustomerProfitPercentage { get; set; }

    // اثر تورم
    public decimal InflationDiscountFactor { get; set; }
    public decimal CumulativeCustomerOutflowReal { get; set; }
    public decimal NetSurrenderValueReal { get; set; }
    public decimal CustomerRealProfitOrLoss { get; set; }

    // وضعیت فوت
    public decimal TotalDeathPayoutToBeneficiaries { get; set; } // سرمایه فوت + اندوخته - مانده وام
}
