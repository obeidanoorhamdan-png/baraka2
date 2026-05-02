import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useTranslation } from "react-i18next";
import { Download, ExternalLink } from "lucide-react";

export const ImagePreviewDialog = ({
  open, onClose, url, title,
}: { open: boolean; onClose: () => void; url: string; title: string }) => {
  const { t } = useTranslation();
  const isPdf = url?.includes(".pdf");
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl">
        <DialogHeader><DialogTitle>{title}</DialogTitle></DialogHeader>
        <div className="bg-muted rounded-md p-2 max-h-[70vh] overflow-auto text-center">
          {url ? (
            isPdf ? (
              <iframe src={url} className="w-full h-[60vh] rounded" title={title} />
            ) : (
              <img src={url} alt={title} className="max-h-[65vh] mx-auto rounded shadow" />
            )
          ) : (
            <div className="py-10 text-muted-foreground">...</div>
          )}
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose}>{t("common.cancel")}</Button>
          {url && (
            <>
              <Button asChild variant="outline" className="gap-1.5">
                <a href={url} download>
                  <Download className="h-4 w-4" /> {t("preview.download")}
                </a>
              </Button>
              <Button asChild className="brand-gradient text-primary-foreground gap-1.5">
                <a href={url} target="_blank" rel="noreferrer">
                  <ExternalLink className="h-4 w-4" /> {t("preview.open_new_tab")}
                </a>
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
