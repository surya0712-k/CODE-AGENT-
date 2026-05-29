using System.Windows.Forms;
using Microsoft.WindowsAPICodePack.Dialogs;

namespace FolderPicker;

internal static class Program
{
    [STAThread]
    private static int Main(string[] args)
    {
        ApplicationConfiguration.Initialize();

        var dialog = new CommonOpenFileDialog
        {
            IsFolderPicker = true,
            Title = "Select your project folder",
            Multiselect = false,
            EnsureReadOnly = false,
            EnsurePathExists = true,
            EnsureValidNames = true,
            AddToMostRecentlyUsedList = false,
        };

        if (!string.IsNullOrWhiteSpace(Environment.GetFolderPath(Environment.SpecialFolder.Desktop)))
        {
            dialog.InitialDirectory = Environment.GetFolderPath(Environment.SpecialFolder.Desktop);
        }

        var result = dialog.ShowDialog();
        if (result != CommonFileDialogResult.Ok || string.IsNullOrWhiteSpace(dialog.FileName))
        {
            return 0;
        }

        Console.WriteLine(dialog.FileName.Trim());
        return 0;
    }
}
