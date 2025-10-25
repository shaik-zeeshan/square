import { Toaster as SolidToaster } from "solid-toast";

export function Toaster() {
  return (
    <SolidToaster
      containerClassName=""
      containerStyle={{}}
      gutter={8}
      position="top-center"
      toastOptions={{
        className: "toaster",
        duration: 5000,
        style: {
          background: "var(--background)",
          color: "var(--foreground)",
          border: "1px solid var(--border)",
          "border-radius": "8px",
          "box-shadow":
            "0 25px 50px -12px rgb(0 0 0 / 0.25), 0 0 0 1px rgb(0 0 0 / 0.05)",
          padding: "12px 16px",
          "font-size": "14px",
          "font-weight": "500",
          "max-width": "420px",
          "min-width": "320px",
        },
      }}
    />
  );
}
