using BancassuranceSim.Web.Services;

var builder = WebApplication.CreateBuilder(args);

// افزودن سرویس‌ها
builder.Services.AddControllers();
builder.Services.AddScoped<ICalculationService, CalculationService>();

// تنظیم پورت در صورت نیاز
builder.WebHost.ConfigureKestrel(options =>
{
    options.ListenAnyIP(5177); // پورت پیش‌فرض برای اجرای لوکال
});

var app = builder.Build();

// پشتیبانی از فایل‌های استاتیک و صفحه index.html
app.UseDefaultFiles();
app.UseStaticFiles();

app.UseRouting();
app.MapControllers();

// مسیر فال‌بک برای وب‌اپ
app.MapFallbackToFile("index.html");

app.Run();
