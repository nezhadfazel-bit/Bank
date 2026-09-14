using Microsoft.AspNetCore.Mvc;
using BancassuranceSim.Web.Models;
using BancassuranceSim.Web.Services;

namespace BancassuranceSim.Web.Controllers;

[ApiController]
[Route("api/[controller]")]
public class SimulationController : ControllerBase
{
    private readonly ICalculationService _calcService;

    public SimulationController(ICalculationService calcService)
    {
        _calcService = calcService;
    }

    [HttpGet("defaults")]
    public ActionResult<ContractInputModel> GetDefaults()
    {
        return Ok(new ContractInputModel());
    }

    [HttpGet("presets")]
    public ActionResult<List<ContractInputModel>> GetPresets()
    {
        return Ok(_calcService.GetPresetScenarios());
    }

    [HttpPost("calculate")]
    public ActionResult<SimulationResultModel> Calculate([FromBody] ContractInputModel input)
    {
        if (input == null)
        {
            return BadRequest("پارامترهای ورودی نامعتبر هستند.");
        }

        var result = _calcService.Calculate(input);
        return Ok(result);
    }
}
