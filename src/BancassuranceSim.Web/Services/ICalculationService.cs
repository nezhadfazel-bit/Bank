using BancassuranceSim.Web.Models;

namespace BancassuranceSim.Web.Services;

public interface ICalculationService
{
    SimulationResultModel Calculate(ContractInputModel input);
    List<ContractInputModel> GetPresetScenarios();
}
