import { useEffect, useState } from "react";
import type {
  ActionFunctionArgs,
  HeadersFunction,
  LoaderFunctionArgs,
} from "react-router";
import { useFetcher, useLoaderData } from "react-router";
import { useAppBridge } from "@shopify/app-bridge-react";
import { boundary } from "@shopify/shopify-app-react-router/server";

import { authenticate } from "../shopify.server";
import { generateListing, type ListingOutput } from "../lib/openai.server";
import {
  getOrCreateShopSettings,
  getUsageStatus,
  markGenerationApplied,
  recordGeneration,
} from "../lib/usage.server";

interface ProductSummary {
  id: string;
  title: string;
  descriptionHtml: string;
  productType: string;
  vendor: string;
  status: string;
  imageUrl: string | null;
}

const PRODUCTS_QUERY = `#graphql
  query ListWiseProducts {
    products(first: 25, sortKey: UPDATED_AT, reverse: true) {
      edges {
        node {
          id
          title
          descriptionHtml
          productType
          vendor
          status
          featuredImage {
            url(transform: {maxWidth: 80, maxHeight: 80})
          }
        }
      }
    }
  }
`;

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);

  const response = await admin.graphql(PRODUCTS_QUERY);
  const json = await response.json();

  const products: ProductSummary[] = (json.data?.products?.edges ?? []).map(
    (edge: any) => ({
      id: edge.node.id,
      title: edge.node.title,
      descriptionHtml: edge.node.descriptionHtml ?? "",
      productType: edge.node.productType ?? "",
      vendor: edge.node.vendor ?? "",
      status: edge.node.status,
      imageUrl: edge.node.featuredImage?.url ?? null,
    }),
  );

  const settings = await getOrCreateShopSettings(session.shop);
  const usage = await getUsageStatus(session.shop);

  return { products, brandVoice: settings.brandVoice, usage };
};

const PRODUCT_UPDATE_MUTATION = `#graphql
  mutation ListWiseUpdateProduct($input: ProductInput!) {
    productUpdate(input: $input) {
      product {
        id
        title
      }
      userErrors {
        field
        message
      }
    }
  }
`;

export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  const formData = await request.formData();
  const intent = formData.get("_action");

  if (intent === "generate") {
    const productsRaw = formData.get("products");
    const tone = String(formData.get("tone") || "neutral");
    const selected: Array<{
      id: string;
      title: string;
      descriptionHtml: string;
      productType: string;
      vendor: string;
    }> = productsRaw ? JSON.parse(String(productsRaw)) : [];

    const results: Record<string, ListingOutput> = {};
    const errors: Record<string, string> = {};

    for (const product of selected) {
      const usage = await getUsageStatus(session.shop);
      if (!usage.allowed) {
        errors[product.id] = "usage_limit_reached";
        continue;
      }

      try {
        const listing = await generateListing({
          title: product.title,
          description: product.descriptionHtml,
          productType: product.productType,
          vendor: product.vendor,
          tone,
        });
        results[product.id] = listing;
        await recordGeneration(session.shop, product.id, product.title);
      } catch (error) {
        errors[product.id] =
          error instanceof Error ? error.message : "generation_failed";
      }
    }

    const usageAfter = await getUsageStatus(session.shop);
    return { intent: "generate", results, errors, usage: usageAfter };
  }

  if (intent === "apply") {
    const productId = String(formData.get("productId"));
    const title = String(formData.get("title") || "");
    const description = String(formData.get("description") || "");
    const metaDescription = String(formData.get("metaDescription") || "");
    const tags = String(formData.get("tags") || "")
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);

    const response = await admin.graphql(PRODUCT_UPDATE_MUTATION, {
      variables: {
        input: {
          id: productId,
          title,
          descriptionHtml: description,
          tags,
          seo: {
            title: title.slice(0, 70),
            description: metaDescription.slice(0, 160),
          },
        },
      },
    });
    const json = await response.json();
    const userErrors = json.data?.productUpdate?.userErrors ?? [];

    if (userErrors.length > 0) {
      return {
        intent: "apply",
        productId,
        success: false,
        error: userErrors.map((e: any) => e.message).join(", "),
      };
    }

    await markGenerationApplied(session.shop, productId);
    return { intent: "apply", productId, success: true };
  }

  return { intent: "unknown" };
};

function usageLabel(usage: { plan: string | null; used: number; limit: number | null }) {
  if (usage.limit === null) return `${usage.used} generations used (unlimited plan)`;
  return `${usage.used} / ${usage.limit} generations used this period`;
}

export default function Index() {
  const { products, brandVoice, usage } = useLoaderData<typeof loader>();
  const generateFetcher = useFetcher<typeof action>();
  const shopify = useAppBridge();

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [tone, setTone] = useState(brandVoice);

  const isGenerating =
    generateFetcher.state !== "idle" &&
    generateFetcher.formData?.get("_action") === "generate";

  const generateData =
    generateFetcher.data?.intent === "generate" ? generateFetcher.data : undefined;

  useEffect(() => {
    if (generateData) {
      const count = Object.keys(generateData.results ?? {}).length;
      if (count > 0) {
        shopify.toast.show(`Generated ${count} listing${count > 1 ? "s" : ""}`);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [generateData]);

  const toggleProduct = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleGenerate = () => {
    const chosen = products.filter((p) => selected.has(p.id));
    if (chosen.length === 0) return;
    generateFetcher.submit(
      {
        _action: "generate",
        tone,
        products: JSON.stringify(
          chosen.map((p) => ({
            id: p.id,
            title: p.title,
            descriptionHtml: p.descriptionHtml,
            productType: p.productType,
            vendor: p.vendor,
          })),
        ),
      },
      { method: "POST" },
    );
  };

  const currentUsage = generateData?.usage ?? usage;
  const results = generateData?.results ?? {};
  const errors = generateData?.errors ?? {};

  return (
    <s-page heading="Generate listings">
      <s-button
        slot="primary-action"
        onClick={handleGenerate}
        {...(isGenerating ? { loading: true } : {})}
        {...(selected.size === 0 ? { disabled: true } : {})}
      >
        Generate {selected.size > 0 ? `(${selected.size})` : ""}
      </s-button>

      {!currentUsage.allowed && (
        <s-banner heading="You've reached your generation limit" tone="warning">
          <s-paragraph>
            {usageLabel(currentUsage)}. Upgrade your plan to keep generating
            AI listings.
          </s-paragraph>
          <s-link href="/app/billing">Go to plan &amp; billing</s-link>
        </s-banner>
      )}

      <s-section heading="Brand voice for this batch">
        <s-select
          label="Tone"
          value={tone}
          onChange={(e: any) => setTone(e.target.value)}
        >
          <s-option value="neutral">Neutral</s-option>
          <s-option value="playful">Playful</s-option>
          <s-option value="luxury">Luxury</s-option>
          <s-option value="minimal">Minimal</s-option>
          <s-option value="bold">Bold</s-option>
        </s-select>
        <s-paragraph>{usageLabel(currentUsage)}</s-paragraph>
      </s-section>

      <s-section heading="Your products">
        {products.length === 0 && (
          <s-paragraph>
            No products found. Add products to your store to get started.
          </s-paragraph>
        )}
        <s-stack direction="block" gap="small">
          {products.map((product) => (
            <s-box
              key={product.id}
              padding="base"
              borderWidth="base"
              borderRadius="base"
            >
              <s-stack direction="inline" gap="base" alignItems="center">
                <s-checkbox
                  checked={selected.has(product.id)}
                  onChange={() => toggleProduct(product.id)}
                  accessibilityLabel={`Select ${product.title}`}
                />
                {product.imageUrl && (
                  <s-thumbnail src={product.imageUrl} alt={product.title} size="small" />
                )}
                <s-text>{product.title}</s-text>
              </s-stack>

              {results[product.id] && (
                <ResultPanel
                  productId={product.id}
                  before={product}
                  after={results[product.id]}
                />
              )}
              {errors[product.id] && (
                <s-banner tone="critical" heading="Could not generate listing">
                  <s-paragraph>{errors[product.id]}</s-paragraph>
                </s-banner>
              )}
            </s-box>
          ))}
        </s-stack>
      </s-section>
    </s-page>
  );
}

function ResultPanel({
  productId,
  before,
  after,
}: {
  productId: string;
  before: ProductSummary;
  after: ListingOutput;
}) {
  const applyFetcher = useFetcher<typeof action>();
  const shopify = useAppBridge();

  const applied =
    applyFetcher.data?.intent === "apply" &&
    applyFetcher.data.productId === productId &&
    applyFetcher.data.success;

  const isApplying = applyFetcher.state !== "idle";

  useEffect(() => {
    if (applied) {
      shopify.toast.show("Product updated");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [applied]);

  return (
    <s-box padding="base" background="subdued" borderRadius="base">
      <applyFetcher.Form method="post">
        <input type="hidden" name="_action" value="apply" />
        <input type="hidden" name="productId" value={productId} />
        <s-stack direction="block" gap="base">
          <s-stack direction="inline" gap="large">
            <s-box padding="small">
              <s-text color="subdued">Before</s-text>
              <s-paragraph>{before.title}</s-paragraph>
            </s-box>
            <s-box padding="small">
              <s-text color="subdued">After (editable)</s-text>
              <s-text-field
                name="title"
                label="Title"
                defaultValue={after.title}
              />
            </s-box>
          </s-stack>
          <s-text-area
            name="description"
            label="Description"
            defaultValue={after.description}
            rows={4}
          />
          <s-text-field
            name="metaDescription"
            label="Meta description"
            defaultValue={after.metaDescription}
          />
          <s-text-field
            name="tags"
            label="Tags (comma separated)"
            defaultValue={after.tags.join(", ")}
          />
          <s-button
            type="submit"
            variant="primary"
            {...(isApplying ? { loading: true } : {})}
            {...(applied ? { disabled: true } : {})}
          >
            {applied ? "Applied" : "Apply to store"}
          </s-button>
        </s-stack>
      </applyFetcher.Form>
    </s-box>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
