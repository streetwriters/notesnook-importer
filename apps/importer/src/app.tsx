import { Flex } from "@theme-ui/components";
import { ThemeProvider } from "@theme-ui/theme-provider";
import "./app.css";
import { ThemeFactory } from "./theme";
import { useEffect, useState } from "react";
import { StepSeperator } from "./components/step-seperator";
import { ProviderSelector } from "./components/provider-selector";
import { FileProviderHandler } from "./components/file-provider-handler";
import { ImportResult } from "./components/import-result";
import { Hero } from "./components/hero";
import { Footer } from "./components/footer";
import { IProvider, ProviderResult } from "@notesnook-importer/core";
import { NetworkProviderHandler } from "./components/network-provider-handler";
import { trackEvent } from "./utils/analytics";

function App() {
  const [selectedProvider, setSelectedProvider] = useState<IProvider>();
  const [providerResult, setProviderResult] = useState<ProviderResult>();

  useEffect(() => {
    if (selectedProvider && providerResult) {
      (async () => {
        await trackEvent(
          { name: selectedProvider.name, type: "event" },
          selectedProvider.name
        );
      })();
    }
  }, [providerResult, selectedProvider]);

  return (
    <ThemeProvider theme={ThemeFactory.construct()}>
      <Flex sx={{ flexDirection: "column" }}>
        <Hero />
        <Flex
          sx={{
            flexDirection: "column",
            alignItems: "center"
          }}
        >
          <ProviderSelector
            onProviderChanged={(provider) => {
              setSelectedProvider(provider);
              setProviderResult(undefined);
            }}
          />

          {selectedProvider ? (
            <>
              <StepSeperator />
              {selectedProvider.type === "file" ? (
                <FileProviderHandler
                  provider={selectedProvider}
                  onTransformFinished={setProviderResult}
                />
              ) : selectedProvider.type === "network" ? (
                <NetworkProviderHandler
                  provider={selectedProvider}
                  onTransformFinished={setProviderResult}
                />
              ) : null}
            </>
          ) : null}
          {providerResult ? (
            <>
              <StepSeperator />
              <ImportResult result={providerResult} />{" "}
            </>
          ) : null}
        </Flex>
        <Footer />
      </Flex>
    </ThemeProvider>
  );
}

export default App;
