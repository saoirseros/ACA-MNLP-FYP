import unittest

from app.models.emotion.model import group_emotion_scores


class EmotionGroupingTest(unittest.TestCase):
    def test_fine_grained_labels_are_summed_into_one_emotion(self):
        scores = [
            {"label": "excitement", "score": 0.35},
            {"label": "gratitude", "score": 0.34},
            {"label": "admiration", "score": 0.32},
            {"label": "neutral", "score": 0.05},
            {"label": "sadness", "score": 0.01},
        ]
        grouped = group_emotion_scores(scores)
        self.assertAlmostEqual(grouped["joy"], 1.01)
        self.assertEqual(max(grouped, key=grouped.get), "joy")

    def test_sympathy_is_sadness_and_every_app_emotion_is_present(self):
        grouped = group_emotion_scores([{"label": "remorse", "score": 0.71}, {"label": "sadness", "score": 0.4}])
        self.assertEqual(max(grouped, key=grouped.get), "sadness")
        self.assertEqual(
            set(grouped), {"joy", "sadness", "anger", "fear", "surprise", "disgust", "neutral"}
        )


if __name__ == "__main__":
    unittest.main()
