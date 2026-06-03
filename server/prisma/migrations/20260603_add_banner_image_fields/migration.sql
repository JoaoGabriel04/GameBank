-- AddBannerImageFields: stores the Cloudinary publicId so admin can delete
-- the image when the banner is updated/replaced/deleted. The actual image
-- URL is stored in the existing `css` field (URL https://... when set).
ALTER TABLE "banners" ADD COLUMN "imagePublicId"  TEXT;
ALTER TABLE "banners" ADD COLUMN "imageUpdatedAt" TIMESTAMP(3);
