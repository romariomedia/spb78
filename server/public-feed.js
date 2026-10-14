// An explicit projection prevents moderation fields (including future ones)
// from escaping through either reads or mutation responses.
const POST_FIELDS = ['authorId','authorName','authorAvatar','authorPlan','sportTag',
  'content','mediaUrl','mediaType','likes','commentsCount','createdAt'];
const COMMENT_FIELDS = ['id','postId','authorId','authorName','authorAvatar','content','createdAt'];
const pick = (value, fields) => Object.fromEntries(fields
  .filter(key => value[key] !== undefined).map(key => [key,value[key]]));
export function publicFeedPost(id, data = {}) {
  if(data.isHidden === true)return null;
  return {...pick(data,POST_FIELDS),id,
    comments:(Array.isArray(data.comments)?data.comments:[]).map(comment=>pick(comment,COMMENT_FIELDS))};
}
