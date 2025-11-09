import { Effect } from "effect";
import { UpdateSerivce } from "~/effect/services/update/serives";
import { createEffectQuery, createQueryKey } from "~/effect/tanstack/query";

class UpdateMethods {
  checkForUpdateKey = createQueryKey("checkForUpdate");
  checkForUpdate = () =>
    createEffectQuery(() => ({
      queryKey: this.checkForUpdateKey(),
      queryFn: () =>
        UpdateSerivce.pipe(Effect.flatMap((jf) => jf.checkForUpdate())),
    }));
}

export const UpdateOperations = new UpdateMethods();
