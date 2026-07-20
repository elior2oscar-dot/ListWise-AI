import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { useLoaderData, useSubmit } from "react-router";

import { authenticate } from "../shopify.server";
import { setShopPlan } from "../lib/usage.server";
import { ALL_PLAN_NAMES, PLAN_DETAILS, type PlanName } from "../lib/plans";

const isTestCharge = process.env.NODE_ENV !== "production";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session, billing } = await authenticate.admin(request);

  const billingCheck = await billing.check({
    plans: ALL_PLAN_NAMES,
    isTest: isTestCharge,
  });

  const activePlan =
    (billingCheck.appSubscriptions?.[0]?.name as PlanName | undefined) ?? null;

  await setShopPlan(session.shop, activePlan);

  return { activePlan, hasActivePayment: billingCheck.hasActivePayment };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { billing } = await authenticate.admin(request);
  const formData = await request.formData();
  const planInput = String(formData.get("plan"));

  if (planInput === "cancel") {
    const billingCheck = await billing.check({
      plans: ALL_PLAN_NAMES,
      isTest: isTestCharge,
    });
    const subscription = billingCheck.appSubscriptions?.[0];
    if (subscription) {
      await billing.cancel({
        subscriptionId: subscription.id,
        isTest: isTestCharge,
        prorate: true,
      });
    }
    return { cancelled: true };
  }

  const plan = planInput as PlanName;

  // billing.request throws a redirect to Shopify's confirmation page.
  await billing.request({
    plan,
    isTest: isTestCharge,
    returnUrl: `${process.env.SHOPIFY_APP_URL}/app/billing`,
  });

  return null;
};

export default function Billing() {
  const { activePlan, hasActivePayment } = useLoaderData<typeof loader>();
  const submit = useSubmit();

  const choosePlan = (plan: PlanName) => {
    submit({ plan }, { method: "POST" });
  };

  const cancelPlan = () => {
    submit({ plan: "cancel" }, { method: "POST" });
  };

  return (
    <s-page heading="Plan &amp; billing">
      <s-section heading="Current plan">
        <s-paragraph>
          {hasActivePayment && activePlan
            ? `You're on the ${activePlan} plan.`
            : "You're on the Free trial (up to 20 AI generations, no card required)."}
        </s-paragraph>
        {hasActivePayment && (
          <s-button variant="tertiary" tone="critical" onClick={cancelPlan}>
            Cancel subscription
          </s-button>
        )}
      </s-section>

      <s-section heading="Available plans">
        <s-stack direction="inline" gap="large">
          {ALL_PLAN_NAMES.map((planName) => {
            const plan = PLAN_DETAILS[planName];
            const isCurrent = activePlan === planName && hasActivePayment;
            return (
              <s-box
                key={planName}
                padding="base"
                borderWidth="base"
                borderRadius="base"
              >
                <s-stack direction="block" gap="base">
                  <s-heading>{plan.name}</s-heading>
                  <s-text>
                    ${plan.price.toFixed(2)} / month
                  </s-text>
                  <s-paragraph>{plan.description}</s-paragraph>
                  <s-unordered-list>
                    {plan.features.map((feature) => (
                      <s-list-item key={feature}>{feature}</s-list-item>
                    ))}
                  </s-unordered-list>
                  <s-button
                    variant={isCurrent ? "tertiary" : "primary"}
                    {...(isCurrent ? { disabled: true } : {})}
                    onClick={() => choosePlan(planName)}
                  >
                    {isCurrent ? "Current plan" : `Choose ${plan.name}`}
                  </s-button>
                </s-stack>
              </s-box>
            );
          })}
        </s-stack>
      </s-section>
    </s-page>
  );
}
