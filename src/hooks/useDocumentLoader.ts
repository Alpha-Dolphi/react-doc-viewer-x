import { Dispatch, useContext, useEffect } from "react";
import { DocViewerContext } from "../store/DocViewerProvider";
import {
  MainStateActions,
  setDocumentLoading,
  updateCurrentDocument,
} from "../store/actions";
import { IMainState } from "../store/mainStateReducer";
import { DocRenderer } from "..";
import {
  defaultFileLoader,
  FileLoaderComplete,
  FileLoaderFuncProps,
} from "../utils/fileLoaders";
import { useRendererSelector } from "./useRendererSelector";

/**
 * Custom Hook for loading the current document into context
 */
export const useDocumentLoader = (): {
  state: IMainState;
  dispatch: Dispatch<MainStateActions>;
  CurrentRenderer: DocRenderer | null | undefined;
} => {
  const { state, dispatch } = useContext(DocViewerContext);
  const { currentFileNo, currentDocument, prefetchMethod } = state;

  const { CurrentRenderer } = useRendererSelector();

  const documentURI = currentDocument?.uri || "";

  useEffect(() => {
    if (!currentDocument || currentDocument.fileType !== undefined) return;

    const controller = new AbortController();
    const { signal } = controller;

    fetch(documentURI, {
      method: prefetchMethod || documentURI.startsWith("blob:") ? "GET" : "HEAD",
      signal,
      headers: state?.requestHeaders,
    })
      .then((response) => {
        const contentTypeRaw = response.headers.get("content-type");
        const contentTypes = contentTypeRaw?.split(";") || [];
        const contentType = contentTypes.length ? contentTypes[0] : undefined;

        if (contentType) {
          dispatch(
            updateCurrentDocument({
              ...currentDocument,
              fileType: contentType || "application/octet-stream",
            }),
          );
        }
      })
      .catch((error) => {
        if (error?.name !== "AbortError") {
          dispatch(
            updateCurrentDocument({
              ...currentDocument,
              fileType: "application/octet-stream",
            }),
          );
        }
      });

    return () => {
      controller.abort();
    };
  }, [currentFileNo, documentURI]);

  useEffect(() => {
    if (!currentDocument || CurrentRenderer === undefined) return;

    const controller = new AbortController();
    const { signal } = controller;

    const fileLoaderComplete: FileLoaderComplete = (fileReader) => {
      if (!currentDocument || !fileReader) {
        dispatch(setDocumentLoading(false));
        return;
      }

      const updatedDocument = { ...currentDocument };
      if (fileReader.result !== null) {
        updatedDocument.fileData = fileReader.result;
      }

      dispatch(updateCurrentDocument(updatedDocument));
      dispatch(setDocumentLoading(false));
    };

    const loaderFunctionProps: FileLoaderFuncProps = {
      documentURI,
      signal,
      fileLoaderComplete,
      headers: state?.requestHeaders,
    };

    if (CurrentRenderer === null) {
      dispatch(setDocumentLoading(false));
    } else if (CurrentRenderer.fileLoader !== undefined) {
      CurrentRenderer.fileLoader?.(loaderFunctionProps);
    } else {
      defaultFileLoader(loaderFunctionProps);
    }

    return () => {
      controller.abort();
    };
  }, [CurrentRenderer, currentFileNo]);

  return { state, dispatch, CurrentRenderer };
};