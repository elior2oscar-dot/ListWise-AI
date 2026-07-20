import { useEffect, useState } from "react";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { useFetcher, useLoaderData } from "react-router";
import { useAppBridge } from "@shopify/app-bridge-react";

import { authenticate } from "../shopify.server";
import { getOrCreateShopSettings, setBrandVoice } from "../lib/usage.server";
import { BRAND_VOICES } from "../lib/plans";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const settings = await getOrCreateShopSettings(session.shop);
  return { brandVoice: settings.brandVoice };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const formData = await request.formData();
  const brandVoice = String(formData.get("brandVoice") || "neutral");
  await setBrandVoice(session.shop, brandVoice);
  return { success: true };
};

export default function Settings() {
  const { brandVoice } = useLoaderData<typeof loader>();
  const fetcher = useFetcher<typeof action>();
  const shopify = useAppBridge();
  const [selected, setSelected] = useState(brandVoice);

  const isSaving = fetcher.state !== "idle";

  useEffect(() => {
    if (fetcher.data?.success) {
      shopify.toast.show("Brand voice saved");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetcher.data]);

  const handleSave = () => {
    fetcher.submit({ brandVoice: selected }, { method: "POST" });
  };

  return (
    <s-page heading="Brand voice">
      <s-button
        slot="primary-action"
        onClick={handleSave}
        {...(isSaving ? { loading: true } : {})}
      >
        Save
      </s-button>

      <s-section heading="Default tone for AI generations">
        <s-paragraph>
          Choose the default tone ListWise AI uses when writing product
          listings. You can still override this per-generation from the
          product list.
        </s-paragraph>
        <s-choice-list
          name="brandVoice"
          values={[selected]}
          onChange={(e: any) => setSelected(e.target.values?.[0] ?? "neutral")}
        >
          {BRAND_VOICES.map((voice) => (
            <s-choice key={voice.id} value={voice.id}>
              {voice.label} — {voice.description}
            </s-choice>
          ))}
        </s-choice-list>
      </s-section>
    </s-page>
  );
}
