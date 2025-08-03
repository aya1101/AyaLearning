Set UAC = CreateObject("Shell.Application") 
UAC.ShellExecute "cmd.exe", "/c ""D:\2. Project\AyaLearning\start-web.bat""", "", "runas", 1
