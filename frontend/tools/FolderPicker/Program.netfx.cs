using System;
using System.Windows.Forms;
using Microsoft.WindowsAPICodePack.Dialogs;

internal static class Program
{
    [STAThread]
    private static int Main()
    {
        Application.EnableVisualStyles();
        Application.SetCompatibleTextRenderingDefault(false);

        var dialog = new CommonOpenFileDialog
        {
            IsFolderPicker = true,
            Title = "Select your project folder",
            Multiselect = false,
            EnsureReadOnly = false,
            EnsurePathExists = true,
            AddToMostRecentlyUsedList = false,
        };

        var desktop = Environment.GetFolderPath(Environment.SpecialFolder.Desktop);
        if (!string.IsNullOrEmpty(desktop))
        {
            dialog.InitialDirectory = desktop;
        }

        if (dialog.ShowDialog() != CommonFileDialogResult.Ok)
        {
            return 0;
        }

        if (!string.IsNullOrWhiteSpace(dialog.FileName))
        {
            Console.WriteLine(dialog.FileName.Trim());
        }

        return 0;
    }
}
