namespace BancassuranceSim.Web.Models;

public class YearlySummaryItem
{
    public int Year { get; set; }
    public decimal CumulativePaid { get; set; }
    public decimal FundValueNominal { get; set; }
    public decimal RemainingLoan { get; set; }
    public decimal NetEquityNominal { get; set; } // اندوخته منهای مانده وام
    public decimal NetEquityReal { get; set; } // ارزش واقعی با احتساب تورم
    public decimal CustomerProfitNominal { get; set; }
    public decimal CustomerProfitReal { get; set; }
    public decimal ReturnOnInvestmentNominalPct { get; set; }
    public decimal ReturnOnInvestmentRealPct { get; set; }
    public bool IsBreakevenNominal { get; set; }
    public bool IsBreakevenReal { get; set; }
    public decimal DeathBenefitNet { get; set; }
}
