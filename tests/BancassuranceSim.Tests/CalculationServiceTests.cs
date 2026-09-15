using Xunit;
using BancassuranceSim.Web.Models;
using BancassuranceSim.Web.Services;

namespace BancassuranceSim.Tests;

public class CalculationServiceTests
{
    private readonly CalculationService _sut = new();

    [Fact]
    public void Calculate_WithDefaultInputs_ProducesAccurateInitialBalanceSheet()
    {
        // Arrange
        var input = new ContractInputModel
        {
            TotalPolicyValue = 100_000_000m,
            CustomerInitialCash = 40_000_000m,
            BankLoanAmount = 60_000_000m,
            BankFeeRate = 0.065m, // 3,900,000
            BankBlockedDepositRate = 0.04m, // 2,400,000
            InsuranceUnderwritingFeeRate = 0.05m, // 5,000,000
            LifeCoverageFeeRate = 0.05m, // 5,000,000
            AgentCommissionRate = 0.02m, // 2,000,000
            DeductBankChargesFromLoanProceeds = true
        };

        // Act
        var result = _sut.Calculate(input);

        // Assert
        Assert.Equal(3_900_000m, result.BankFeeAmount);
        Assert.Equal(2_400_000m, result.BankBlockedDepositAmount);
        Assert.Equal(5_000_000m, result.InsuranceUnderwritingFeeAmount);
        Assert.Equal(5_000_000m, result.LifeCoverageFeeAmount);
        Assert.Equal(2_000_000m, result.AgentCommissionAmount);

        // Net initial fund = (40M + 60M - 3.9M - 2.4M) - (5M + 5M + 2M) = 81.7M
        Assert.Equal(81_700_000m, result.NetInitialFundDeposit);
    }

    [Fact]
    public void Calculate_LoanAmortization_SumsToExactPrincipal()
    {
        // Arrange
        var input = new ContractInputModel
        {
            BankLoanAmount = 60_000_000m,
            BankLoanAnnualInterestRate = 0.23m,
            BankLoanTenureMonths = 24
        };

        // Act
        var result = _sut.Calculate(input);

        // Assert
        var totalPrincipalPaid = result.MonthlySchedule
            .Where(m => m.Month <= 24)
            .Sum(m => m.MonthlyPrincipalPaid);

        // Total principal paid across 24 months should equal exactly 60M
        Assert.True(Math.Abs(totalPrincipalPaid - 60_000_000m) < 1.0m);
        Assert.Equal(0m, result.MonthlySchedule.First(m => m.Month == 24).RemainingLoanBalance);
    }

    [Fact]
    public void Calculate_BlockedDeposit_IsReleasedAtMonth12()
    {
        // Arrange
        var input = new ContractInputModel
        {
            BankLoanAmount = 60_000_000m,
            BankBlockedDepositRate = 0.04m, // 2.4M
            BankBlockedDepositDurationMonths = 12,
            DeductBankChargesFromLoanProceeds = true,
            FundAnnualReturnRate = 0.0m // zero return to isolate deposit addition
        };

        // Act
        var result = _sut.Calculate(input);

        // Assert
        var m11 = result.MonthlySchedule.First(m => m.Month == 11);
        var m12 = result.MonthlySchedule.First(m => m.Month == 12);

        // At month 12, exactly 2.4M is added back
        Assert.Equal(m11.FundValueEnding + 2_400_000m, m12.FundValueEnding);
    }

    [Fact]
    public void Calculate_Breakeven_IsDetectedCorrectly()
    {
        // Arrange
        var input = new ContractInputModel
        {
            FundAnnualReturnRate = 0.35m, // Strong fund yield
            BankLoanAnnualInterestRate = 0.23m,
            BankLoanTenureMonths = 24
        };

        // Act
        var result = _sut.Calculate(input);

        // Assert
        Assert.NotNull(result.NominalBreakevenMonth);
        Assert.True(result.NominalBreakevenMonth > 0 && result.NominalBreakevenMonth <= 120);

        // At breakeven month, NetSurrenderValue >= CumulativeCustomerOutflow
        var beMonthItem = result.MonthlySchedule.First(m => m.Month == result.NominalBreakevenMonth.Value);
        Assert.True(beMonthItem.NetSurrenderValue >= beMonthItem.CumulativeCustomerOutflow);
    }

    [Fact]
    public void Calculate_MortalityScenarios_CalculatesNetPayoutCorrectly()
    {
        // Arrange
        var input = new ContractInputModel
        {
            LifeCoverageCapital = 100_000_000m
        };

        // Act
        var result = _sut.Calculate(input);

        // Assert
        Assert.NotEmpty(result.MortalityScenarios);
        foreach (var scenario in result.MortalityScenarios)
        {
            // Net payout = Life benefit + Fund value - Remaining loan
            var expectedNet = scenario.LifeInsuranceBenefit + scenario.AccumulatedFundValue - scenario.RemainingLoanToSettle;
            Assert.Equal(expectedNet, scenario.NetPayoutToFamily);
            Assert.True(scenario.NetPayoutToFamily > 0);
        }
    }

    [Fact]
    public void Calculate_InflationDiscount_ReducesRealPurchasingPower()
    {
        // Arrange
        var input = new ContractInputModel
        {
            AnnualInflationRate = 0.40m,
            SimulationYears = 5
        };

        // Act
        var result = _sut.Calculate(input);

        // Assert
        var lastYear = result.YearlySummaries.Last();
        // Due to inflation, real equity must be strictly less than nominal equity
        Assert.True(lastYear.NetEquityReal < lastYear.NetEquityNominal);
    }

    [Fact]
    public void Calculate_ThreeStakeholderStrategicAnalyses_ArePopulatedWithProsAndCons()
    {
        // Arrange
        var input = new ContractInputModel
        {
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
        };

        // Act
        var result = _sut.Calculate(input);

        // Assert Customer Analysis
        Assert.NotNull(result.CustomerAnalysis);
        Assert.NotEmpty(result.CustomerAnalysis.Advantages);
        Assert.NotEmpty(result.CustomerAnalysis.DisadvantagesAndRisks);
        Assert.True(result.CustomerAnalysis.InitialLeverageRatio >= 2.5m);

        // Assert Bank Analysis
        Assert.NotNull(result.BankAnalysis);
        Assert.NotEmpty(result.BankAnalysis.Advantages);
        Assert.NotEmpty(result.BankAnalysis.DisadvantagesAndRisks);
        Assert.Equal(0m, result.BankAnalysis.DefaultRiskRate);
        Assert.True(result.BankAnalysis.EffectiveAnnualYieldAPR > 0.25m);

        // Assert Insurance Analysis
        Assert.NotNull(result.InsuranceAnalysis);
        Assert.NotEmpty(result.InsuranceAnalysis.Advantages);
        Assert.NotEmpty(result.InsuranceAnalysis.DisadvantagesAndRisks);
        Assert.Equal(100_000_000m, result.InsuranceAnalysis.UpfrontCashInflow);
    }
}
