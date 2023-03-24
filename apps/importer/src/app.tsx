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
import { IProvider } from "@notesnook-importer/core";
import { NetworkProviderHandler } from "./components/network-provider-handler";
import { trackEvent } from "./utils/analytics";
import { TransformResult } from "./types";

function App() {
  const [selectedProvider, setSelectedProvider] = useState<IProvider>();
  const [transformResult, setTransformResult] = useState<TransformResult>();

  useEffect(() => {
    if (selectedProvider && transformResult) {
      (async () => {
        await trackEvent(
          { name: selectedProvider.name, type: "event" },
          selectedProvider.name
        );
      })();
    }
  }, [transformResult, selectedProvider]);

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
              setTransformResult(undefined);
            }}
          />

          {selectedProvider && !transformResult ? (
            <>
              <StepSeperator />
              {selectedProvider.type === "file" ? (
                <FileProviderHandler
                  provider={selectedProvider}
                  onTransformFinished={setTransformResult}
                />
              ) : selectedProvider.type === "network" ? (
                <NetworkProviderHandler
                  provider={selectedProvider}
                  onTransformFinished={setTransformResult}
                />
              ) : null}
            </>
          ) : null}
          {transformResult && selectedProvider ? (
            <>
              <StepSeperator />
              <ImportResult
                result={transformResult}
                provider={selectedProvider}
                onReset={() => {
                  setTransformResult(undefined);
                }}
              />
            </>
          ) : null}
        </Flex>
        <Footer />
      </Flex>
    </ThemeProvider>
  );
}

export default App;
