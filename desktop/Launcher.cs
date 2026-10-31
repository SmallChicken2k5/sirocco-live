using System;
using System.Diagnostics;
using System.Drawing;
using System.IO;
using System.Net;
using System.Threading;
using System.Windows.Forms;

[assembly: System.Reflection.AssemblyTitle("Sirocco Live")]
[assembly: System.Reflection.AssemblyDescription("Sirocco Team broadcast studio")]
[assembly: System.Reflection.AssemblyCompany("Sirocco Team")]
[assembly: System.Reflection.AssemblyProduct("Sirocco Live")]
[assembly: System.Reflection.AssemblyVersion("1.2.0.0")]
[assembly: System.Reflection.AssemblyFileVersion("1.2.0.0")]

namespace SiroccoLive {
    internal static class Program {
        [STAThread]
        static int Main(string[] args) {
            Application.EnableVisualStyles();
            Application.SetCompatibleTextRenderingDefault(false);
            bool smoke = Array.IndexOf(args,"--smoke-test") >= 0;
            bool noBrowser = Array.IndexOf(args,"--no-browser") >= 0;
            int port = 8765;
            string customData = null;
            foreach(string arg in args) {
                if(arg.StartsWith("--port=")) { int requested; if(int.TryParse(arg.Substring(7),out requested) && requested >= 1024 && requested <= 65535) port=requested; }
                if(arg.StartsWith("--data-dir=")) customData=Path.GetFullPath(arg.Substring(11));
            }
            bool created;
            using(var mutex=new Mutex(true,"Local\\SiroccoLive-"+port,out created)) {
                if(!created) { if(!smoke) Open("http://127.0.0.1:"+port+"/"); return 0; }
                StudioContext context=null;
                try {
                    context=new StudioContext(port,customData,smoke);
                    if(smoke) { context.Verify(); return 0; }
                    context.ShowTray();
                    if(!noBrowser) Open(context.Url+"/");
                    Application.Run(context);
                    return 0;
                } catch(Exception e) {
                    if(smoke) return 1;
                    MessageBox.Show(e.Message,"Sirocco Live",MessageBoxButtons.OK,MessageBoxIcon.Warning);
                    return 1;
                } finally { if(context!=null) context.Dispose(); }
            }
        }
        internal static void Open(string url) { Process.Start(new ProcessStartInfo(url){UseShellExecute=true}); }
    }

    internal sealed class StudioContext : ApplicationContext {
        internal readonly string Url;
        private readonly string folder;
        private readonly string logFolder;
        private Process server;
        private NotifyIcon tray;
        private StreamWriter output;
        private StreamWriter errors;
        private readonly object logLock=new object();
        private bool stopping;

        internal StudioContext(int port,string customData,bool smoke) {
            Url="http://127.0.0.1:"+port;
            folder=AppDomain.CurrentDomain.BaseDirectory;
            string profile=customData ?? Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),"Sirocco Live","data");
            logFolder=Path.Combine(profile,"..","logs");
            Directory.CreateDirectory(profile); Directory.CreateDirectory(logFolder);
            if(Healthy()) return;
            string node=Path.Combine(folder,"runtime","node.exe");
            string entry=Path.Combine(folder,"app","server.mjs");
            if(!File.Exists(node)||!File.Exists(entry)) throw new Exception("Bộ ứng dụng chưa đầy đủ. Hãy giải nén toàn bộ file ZIP rồi mở Sirocco Live.exe.");
            output=new StreamWriter(Path.Combine(logFolder,"server.log"),true); output.AutoFlush=true;
            errors=new StreamWriter(Path.Combine(logFolder,"error.log"),true); errors.AutoFlush=true;
            var start=new ProcessStartInfo(node,"\""+entry+"\"") {
                WorkingDirectory=Path.GetDirectoryName(entry),UseShellExecute=false,CreateNoWindow=true,
                RedirectStandardOutput=true,RedirectStandardError=true
            };
            start.EnvironmentVariables["PORT"]=port.ToString();
            start.EnvironmentVariables["SIROCCO_DATA_DIR"]=profile;
            server=new Process(); server.StartInfo=start;
            server.OutputDataReceived+=(s,e)=>{if(e.Data!=null) lock(logLock){if(output!=null)output.WriteLine(e.Data);}};
            server.ErrorDataReceived+=(s,e)=>{if(e.Data!=null) lock(logLock){if(errors!=null)errors.WriteLine(e.Data);}};
            try {
                server.Start(); server.BeginOutputReadLine(); server.BeginErrorReadLine();
                for(int i=0;i<40;i++) {
                    if(server.HasExited) throw new Exception("Không thể mở máy chủ. Cổng "+port+" có thể đang được ứng dụng khác sử dụng. Nhật ký: "+logFolder);
                    if(Healthy()) return;
                    Thread.Sleep(250);
                }
                throw new Exception("Máy chủ chưa sẵn sàng. Xem nhật ký tại: "+logFolder);
            } catch { StopOwnedServer(); CloseLogs(); throw; }
        }
        private string Get(string route) {
            var request=(HttpWebRequest)WebRequest.Create(Url+route);
            request.Timeout=700; request.ReadWriteTimeout=700; request.Proxy=null;
            using(var response=(HttpWebResponse)request.GetResponse())
            using(var reader=new StreamReader(response.GetResponseStream())) return reader.ReadToEnd();
        }
        private bool Healthy() { try{return Get("/api/health").Contains("\"name\":\"Sirocco Live\"");}catch{return false;} }
        internal void Verify() {
            if(!Get("/api/health").Contains("\"version\":\"1.2.0\"")) throw new Exception("Unexpected server version");
            if(!Get("/").Contains("sirocco-favicon.png")) throw new Exception("Missing branded UI");
            if(!Get("/api/state").Contains("snapshots")) throw new Exception("Missing studio state");
            if(!Get("/view/pro").Contains("studio.css")) throw new Exception("Missing broadcast route");
            if(!Get("/view/nonpro").Contains("studio.css")) throw new Exception("Missing nonpro broadcast route");
            Get("/assets/sirocco-favicon.png"); Get("/assets/icons.svg");
        }
        internal void ShowTray() {
            var menu=new ContextMenuStrip();
            menu.Items.Add("Mở phòng điều khiển",null,(s,e)=>Program.Open(Url+"/"));
            menu.Items.Add("Nguồn Không chuyên",null,(s,e)=>Program.Open(Url+"/view/nonpro"));
            menu.Items.Add("Nguồn Chuyên Tin",null,(s,e)=>Program.Open(Url+"/view/pro"));
            menu.Items.Add(new ToolStripSeparator());
            menu.Items.Add("Mở thư mục nhật ký",null,(s,e)=>Process.Start("explorer.exe","\""+Path.GetFullPath(logFolder)+"\""));
            menu.Items.Add(new ToolStripSeparator());
            menu.Items.Add(server==null?"Thoát biểu tượng":"Dừng nguồn & thoát",null,(s,e)=>ExitThread());
            tray=new NotifyIcon{Text="Sirocco Live · Máy chủ đang chạy",Icon=Icon.ExtractAssociatedIcon(Application.ExecutablePath),ContextMenuStrip=menu,Visible=true};
            tray.DoubleClick+=(s,e)=>Program.Open(Url+"/");
            tray.BalloonTipTitle="Sirocco Live đã sẵn sàng";
            tray.BalloonTipText="Nguồn chạy trong nền. Nhấp đúp biểu tượng để mở bảng điều khiển.";
            tray.ShowBalloonTip(3000);
        }
        private void StopOwnedServer() {
            if(server==null)return;
            try{if(!server.HasExited){server.Kill();server.WaitForExit(3000);}}catch(InvalidOperationException){}
            server.Dispose(); server=null;
        }
        private void CloseLogs(){lock(logLock){if(output!=null)output.Dispose();if(errors!=null)errors.Dispose();output=null;errors=null;}}
        protected override void ExitThreadCore(){StopOwnedServer();base.ExitThreadCore();}
        protected override void Dispose(bool disposing) {
            if(disposing&&!stopping){stopping=true;if(tray!=null){tray.Visible=false;tray.Dispose();}StopOwnedServer();CloseLogs();}
            base.Dispose(disposing);
        }
    }
}
