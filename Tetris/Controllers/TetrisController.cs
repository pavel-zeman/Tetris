using System.Web.Mvc;

namespace Tetris.Controllers
{
    [AllowAnonymous]
    public class TetrisController : Controller
    {
        public ActionResult Index()
        {
            return View();
        }
    }
}