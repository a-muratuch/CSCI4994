import type { Metadata } from "next";
import {
  inventoryReady,
  loadCatalog,
  loadPricing,
  loadTruckOptions,
} from "@/lib/inventory/data";
import { inventoryRooms } from "@/lib/requests/inventory";
import { PageHeading, Panel, focusClass } from "../admin-ui";
import {
  CapacityForm,
  CatalogItemForm,
  PricingForm,
} from "./inventory-controls";
import { EstimateDefaultsForm } from "./estimate-defaults-form";
import {
  estimateDefaultsReady,
  loadEstimateDefaults,
} from "@/lib/estimates/defaults";

export default async function Page() {
  const heading = (
    <PageHeading
      title="Inventory & pricing"
      description="Catalog sizes, truck capacities and the rates used for suggested estimates."
    />
  );
  if (!(await inventoryReady()))
    return (
      <>
        {heading}
        <Panel>
          <p>
            Inventory estimates are not enabled yet. They become available after
            the Phase 7A database migration is applied.
          </p>
        </Panel>
      </>
    );
  const [catalog, pricing, trucks, defaultsReady, defaults] = await Promise.all(
    [
      loadCatalog(true),
      loadPricing(),
      loadTruckOptions(),
      estimateDefaultsReady(),
      loadEstimateDefaults(),
    ],
  );
  const unavailable = (what: string) => (
    <p role="alert">{what} could not be loaded. Reload to try again.</p>
  );
  return (
    <>
      {heading}
      <nav aria-label="Sections" className="mb-5 flex flex-wrap gap-2">
        {[
          ["#pricing", "Pricing"],
          ["#trucks", "Truck capacities"],
          ["#catalog", "Inventory catalog"],
          ...(defaultsReady
            ? [["#standard-text", "Standard estimate text"]]
            : []),
        ].map(([href, label]) => (
          <a
            key={href}
            href={href}
            className={`inline-flex min-h-11 items-center rounded-full border bg-card px-3.5 text-[13px] font-medium hover:bg-muted ${focusClass}`}
          >
            {label}
          </a>
        ))}
      </nav>
      <div className="grid items-start gap-5 lg:grid-cols-2">
        <Panel>
          <h2 id="pricing" className="scroll-mt-6 text-[17px] font-semibold">
            Pricing for suggestions
          </h2>
          <p className="text-sm text-muted-foreground">
            Suggestions are a starting point. Administrators still review and
            edit every estimate before publishing. Saved estimates do not
            change.
          </p>
          {pricing ? (
            <PricingForm settings={pricing} />
          ) : (
            unavailable("Pricing")
          )}
        </Panel>
        <Panel>
          <h2 id="trucks" className="scroll-mt-6 text-[17px] font-semibold">
            Truck capacities
          </h2>
          <p className="text-sm text-muted-foreground">
            The suggestion picks the smallest active truck that fits the
            inventory. Leave blank if unknown.
          </p>
          {!trucks ? (
            unavailable("Trucks")
          ) : trucks.length === 0 ? (
            <p className="text-sm">No trucks saved yet.</p>
          ) : (
            <ul className="space-y-4">
              {trucks.map((truck) => (
                <li key={truck.id}>
                  <CapacityForm truck={truck} />
                  {!truck.active && (
                    <p className="text-xs text-muted-foreground">
                      Inactive: not used for suggestions.
                    </p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
      {defaultsReady && (
        <Panel className="mt-5">
          <h2
            id="standard-text"
            className="scroll-mt-6 text-[17px] font-semibold"
          >
            Standard estimate text
          </h2>
          <p className="text-sm text-muted-foreground">
            New estimate drafts start with these lists and terms. Edit them on
            each estimate as needed; saved estimates do not change.
          </p>
          {defaults ? (
            <EstimateDefaultsForm defaults={defaults} />
          ) : (
            unavailable("Standard text")
          )}
        </Panel>
      )}
      <Panel className="mt-5">
        <h2 id="catalog" className="scroll-mt-6 text-[17px] font-semibold">
          Inventory catalog
        </h2>
        <p className="text-sm text-muted-foreground">
          Customers choose from active items. Changing an item never changes
          inventories already saved on requests.
        </p>
        <CatalogItemForm />
        {!catalog ? (
          unavailable("The catalog")
        ) : (
          <div className="space-y-5">
            {inventoryRooms.map((room) => {
              const items = catalog.filter((item) => item.room === room);
              if (!items.length) return null;
              return (
                <section key={room} aria-label={room} className="space-y-2">
                  <h3 className="font-medium">{room}</h3>
                  <ul className="divide-y rounded-lg border">
                    {items.map((item) => (
                      <li key={item.id}>
                        <details className="p-3">
                          <summary className="min-h-11 cursor-pointer content-center text-sm">
                            <span className="font-medium">{item.name}</span> ·{" "}
                            {item.cubicFeet} cu ft · {item.weightLb} lb
                            {!item.active && (
                              <span className="text-muted-foreground">
                                {" "}
                                · Hidden from customers
                              </span>
                            )}
                          </summary>
                          <div className="mt-3">
                            <CatalogItemForm item={item} />
                          </div>
                        </details>
                      </li>
                    ))}
                  </ul>
                </section>
              );
            })}
          </div>
        )}
      </Panel>
    </>
  );
}

export const metadata: Metadata = { title: "Inventory & pricing" };
