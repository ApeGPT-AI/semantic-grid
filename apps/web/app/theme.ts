import type { ThemeOptions } from "@mui/material";
import { Inconsolata, Space_Grotesk } from "next/font/google";

export const mainFont = Space_Grotesk({ subsets: ["latin"] }); // Customize subsets if needed
export const monospaceFont = Inconsolata({ subsets: ["latin"] }); // Customize subsets if needed

export const defaultLightTheme: ThemeOptions = {
  palette: {
    mode: "light",
  },
  breakpoints: {
    values: {
      xs: 0,
      sm: 600,
      md: 900,
      lg: 1200,
      xl: 1560,
    },
  },
  typography: {
    caption: {
      fontFamily: [monospaceFont.style.fontFamily, "Courier", "monospace"].join(
        ",",
      ),
    },
    fontFamily: [mainFont.style.fontFamily, "Arial", "sans-serif"].join(","),
    fontWeightRegular: 400,
    fontSize: 16,
  },
};

export const defaultDarkTheme: ThemeOptions = {
  palette: {
    mode: "dark",
  },
  breakpoints: {
    values: {
      xs: 0,
      sm: 600,
      md: 900,
      lg: 1200,
      xl: 1560,
    },
  },
  typography: {
    caption: {
      fontFamily: [monospaceFont.style.fontFamily, "Courier", "monospace"].join(
        ",",
      ),
    },
    fontFamily: [mainFont.style.fontFamily, "Arial", "sans-serif"].join(","),
    fontWeightRegular: 400,
    fontSize: 16,
  },
};

export const overrides = (mode: string): ThemeOptions =>
  mode === "light"
    ? {
        palette: {
          text: {
            primary: "#000",
            secondary: "#333",
          },
          primary: {
            main: "#EF8626",
            dark: "#BF6C1E",
            light: "#FF9E42",
            contrastText: "#121212",
          },
          warning: {
            main: "#EF8626",
            dark: "#BF6C1E",
            light: "#FF9E42",
          },
          background: {
            default: "#ffffff",
          },
        },
        components: {
          MuiPaper: {
            styleOverrides: {
              root: {
                backgroundColor: "palette.background.default",
                backgroundImage: "none",
              },
            },
          },
          MuiAppBar: {
            styleOverrides: {
              colorPrimary: {
                backgroundColor: "transparent",
              },
            },
          },
          MuiCard: {
            styleOverrides: {
              // boxShadow: "0 25px 50px -12px rgba(0,0,0,0.25)",
            },
          },
          // @ts-ignore
          MuiDataGrid: {
            styleOverrides: {
              root: {
                border: "none",
                // fontFamily: ["Courier"],
                fontFamily: [
                  monospaceFont.style.fontFamily,
                  "Courier",
                  "monospace",
                ].join(","),
              },
            },
          },
          MuiRating: {
            styleOverrides: {
              icon: {
                color: "#EF8626", // Default star color
              },
              iconFilled: {
                color: "#EF8626", // Filled stars color
              },
              iconHover: {
                color: "#FF9E42", // Hover color
              },
              iconEmpty: {
                color: "#BF6C1E", // Empty stars color
              },
            },
          },
        },
      }
    : {
        palette: {
          text: {
            primary: "#fff",
            secondary: "#ccc",
          },
          primary: {
            main: "#EF8626",
            dark: "#BF6C1E",
            light: "#FF9E42",
            contrastText: "#121212",
          },
          warning: {
            main: "#EF8626",
            dark: "#BF6C1E",
            light: "#FF9E42",
          },
          background: {
            default: "#121212",
          },
          action: {
            disabledBackground: "#3070F6",
          },
        },
        components: {
          MuiPaper: {
            styleOverrides: {
              root: {
                backgroundColor: "palette.background.default",
                backgroundImage: "none",
              },
            },
          },
          // @ts-ignore
          MuiDataGrid: {
            styleOverrides: {
              root: {
                border: "none",
                fontFamily: [
                  monospaceFont.style.fontFamily,
                  "Courier",
                  "monospace",
                ].join(","),
              },
            },
          },
          MuiAppBar: {
            styleOverrides: {
              colorPrimary: {
                backgroundColor: "#121212",
              },
            },
          },
          MuiRating: {
            styleOverrides: {
              icon: {
                color: "#1079D9", // Default star color
              },
              iconFilled: {
                color: "#1079D9", // Filled stars color
              },
              iconHover: {
                color: "#1391FF", // Hover color
              },
              iconEmpty: {
                color: "#0D61AE", // Empty stars color
              },
            },
          },
        },
      };

export const theme = defaultLightTheme;
