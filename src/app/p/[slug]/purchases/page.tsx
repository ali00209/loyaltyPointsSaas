"use client";

import { useParams } from "next/navigation";
import Link from "next/link";
import { useState } from "react";
import { Package, Star } from "lucide-react";
import { VStack, HStack } from "@astryxdesign/core/Layout";
import { Center } from "@astryxdesign/core/Center";
import { Text, Heading } from "@astryxdesign/core/Text";
import { Card } from "@astryxdesign/core/Card";
import { Button } from "@astryxdesign/core/Button";
import { Icon } from "@astryxdesign/core/Icon";
import { Dialog, DialogHeader } from "@astryxdesign/core/Dialog";
import { NumberInput } from "@astryxdesign/core/NumberInput";
import { TextArea } from "@astryxdesign/core/TextArea";
import { EmptyState } from "@astryxdesign/core/EmptyState";
import { useToast } from "@astryxdesign/core/Toast";
import AppLoading from "@/components/AppLoading";
import {
  usePortalCustomer,
  usePortalPurchases,
  usePostPortalReview,
} from "@/lib/query";
import { formatPKR } from "@/lib/money";

interface ReviewTarget {
  purchaseId: string;
  productId: string;
  productName: string;
}

export default function PurchasesPage() {
  const params = useParams<{ slug: string }>();
  const slug = params.slug;
  const showToast = useToast();
  const { data: customer, isLoading: customerLoading } = usePortalCustomer();
  const { data: purchases = [], isLoading: purchasesLoading } =
    usePortalPurchases();
  const reviewMutation = usePostPortalReview();
  const [reviewTarget, setReviewTarget] = useState<ReviewTarget | null>(null);
  const [rating, setRating] = useState<number | null>(null);
  const [text, setText] = useState("");

  if (customerLoading || purchasesLoading) {
    return <AppLoading label="Loading your purchases..." />;
  }

  if (!customer) {
    return (
      <Center axis="both" className="min-h-dvh">
        <EmptyState
          title="Please log in"
          description="Log in to see your purchases and leave reviews."
          actions={
            <Link
              href={`/p/${slug}`}
              className="text-accent font-medium hover:underline"
            >
              Log in
            </Link>
          }
        />
      </Center>
    );
  }

  const openReview = (target: ReviewTarget) => {
    setReviewTarget(target);
    setRating(null);
    setText("");
  };

  const handleSubmitReview = async () => {
    if (!reviewTarget || rating == null) return;
    try {
      const result = await reviewMutation.mutateAsync({
        purchaseId: reviewTarget.purchaseId,
        productId: reviewTarget.productId,
        rating,
        text,
      });
      showToast({
        type: "info",
        body: result.updated
          ? "Review updated"
          : `+${result.pointsAwarded} pts`,
      });
      setReviewTarget(null);
    } catch (err) {
      showToast({
        type: "error",
        body: err instanceof Error ? err.message : "Failed to submit review",
      });
    }
  };

  return (
    <VStack gap={6} hAlign="stretch">
      <VStack gap={1}>
        <Heading level={1}>Your purchases</Heading>
        <Text type="body" color="secondary">
          Review the items you&apos;ve bought and earn points
        </Text>
      </VStack>

      {purchases.length === 0 ? (
        <Card padding={8}>
          <EmptyState
            title="No purchases yet"
            description="When you make a purchase, it will show up here"
            icon={<Icon icon={Package} size="lg" />}
          />
        </Card>
      ) : (
        <VStack gap={4} hAlign="stretch">
          {purchases.map((purchase) => (
            <Card key={purchase.eventId} padding={6}>
              <VStack gap={3} hAlign="stretch">
                <HStack gap={3} hAlign="between" vAlign="center">
                  <VStack gap={0}>
                    <Text type="body" weight="medium">
                      {purchase.orderNumber ?? "Order"}
                    </Text>
                    <Text type="supporting" color="secondary">
                      {new Date(purchase.occurredAt).toLocaleDateString()}
                    </Text>
                  </VStack>
                  <Text type="body" weight="bold" hasTabularNumbers>
                    {formatPKR(purchase.orderAmount)}
                  </Text>
                </HStack>
                {purchase.appliedBenefit && purchase.appliedBenefit.discountAmount > 0 && (
                  <Text type="supporting" color="secondary">
                    Applied loyalty discount: {formatPKR(purchase.appliedBenefit.discountAmount)} · {purchase.appliedBenefit.pointsCost.toLocaleString()} points
                  </Text>
                )}

                <VStack gap={2} hAlign="stretch">
                  {purchase.items.map((item) => (
                    <HStack
                      key={item.productId}
                      gap={3}
                      hAlign="between"
                      vAlign="center"
                      className="rounded-lg bg-muted px-4 py-3"
                    >
                      <VStack gap={0}>
                        <Text type="body" weight="medium">
                          {item.productName}
                        </Text>
                        <Text type="supporting" color="secondary">
                          {item.quantity} × {formatPKR(item.unitPrice)}
                        </Text>
                      </VStack>
                      {item.reviewed && item.review ? (
                        <HStack gap={3} vAlign="center">
                          <HStack gap={1} vAlign="center">
                            <Icon
                              icon={Star}
                              size="sm"
                              className="text-yellow-vivid"
                            />
                            <Text type="body" weight="medium" hasTabularNumbers>
                              {item.review.rating}
                            </Text>
                          </HStack>
                          <Text
                            type="supporting"
                            color="secondary"
                            maxLines={2}
                          >
                            {item.review.text}
                          </Text>
                        </HStack>
                      ) : (
                        <Button
                          label="Write review"
                          variant="secondary"
                          size="sm"
                          icon={<Star size="1em" />}
                          onClick={() =>
                            openReview({
                              purchaseId: purchase.eventId,
                              productId: item.productId,
                              productName: item.productName,
                            })
                          }
                        />
                      )}
                    </HStack>
                  ))}
                </VStack>
              </VStack>
            </Card>
          ))}
        </VStack>
      )}

      <Dialog
        isOpen={Boolean(reviewTarget)}
        onOpenChange={(open) => {
          if (!open) setReviewTarget(null);
        }}
        purpose="form"
        width={460}
      >
        <DialogHeader
          title={
            reviewTarget
              ? `Review ${reviewTarget.productName}`
              : "Write a review"
          }
          onOpenChange={(open) => {
            if (!open) setReviewTarget(null);
          }}
        />
        <VStack gap={3} hAlign="stretch">
          <NumberInput
            label="Rating (1–5)"
            value={rating}
            onChange={setRating}
            min={1}
            max={5}
            isIntegerOnly
            isRequired
          />
          <TextArea
            label="Review"
            placeholder="What did you think of this product?"
            value={text}
            onChange={setText}
            rows={4}
            isOptional
          />
        </VStack>
        <HStack gap={3}>
          <Button
            label="Cancel"
            variant="secondary"
            onClick={() => setReviewTarget(null)}
            width="100%"
          />
          <Button
            label="Submit review"
            variant="primary"
            isLoading={reviewMutation.isPending}
            isDisabled={rating == null}
            onClick={handleSubmitReview}
            width="100%"
          />
        </HStack>
      </Dialog>
    </VStack>
  );
}
