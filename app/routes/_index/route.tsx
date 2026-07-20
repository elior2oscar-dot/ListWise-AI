import type { LoaderFunctionArgs } from "react-router";
import { redirect, Form, useLoaderData } from "react-router";

import { login } from "../../shopify.server";

import styles from "./styles.module.css";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const url = new URL(request.url);

  if (url.searchParams.get("shop")) {
    throw redirect(`/app?${url.searchParams.toString()}`);
  }

  return { showForm: Boolean(login) };
};

export default function App() {
  const { showForm } = useLoaderData<typeof loader>();

  return (
    <div className={styles.index}>
      <div className={styles.content}>
        <h1 className={styles.heading}>ListWise AI</h1>
        <p className={styles.text}>
          Write SEO-optimized product titles, descriptions, and tags for your
          Shopify catalog in one click.
        </p>
        {showForm && (
          <Form className={styles.form} method="post" action="/auth/login">
            <label className={styles.label}>
              <span>Shop domain</span>
              <input className={styles.input} type="text" name="shop" />
              <span>e.g: my-shop-domain.myshopify.com</span>
            </label>
            <button className={styles.button} type="submit">
              Log in
            </button>
          </Form>
        )}
        <ul className={styles.list}>
          <li>
            <strong>SEO-first writing</strong>. Every title and meta
            description is optimized to help shoppers find your products.
          </li>
          <li>
            <strong>Bulk generation</strong>. Generate listings for your
            entire catalog in a single run.
          </li>
          <li>
            <strong>Review before publish</strong>. Compare before/after and
            apply with one click, nothing changes without your approval.
          </li>
        </ul>
      </div>
    </div>
  );
}
