import unittest

from app.context.scoring import score_context_requirement
from app.context.selector import select_context_messages
from app.context.signals import reference_signal


class ReferenceSignalTest(unittest.TestCase):
    def test_demonstrative_determiners_are_not_back_references(self):
        for text in ("I absolutely love this new phone, the camera is amazing!", "That restaurant was great"):
            self.assertEqual(reference_signal(text), 0.0, text)

    def test_demonstrative_pronouns_and_pronouns_are_back_references(self):
        for text in ("That's disappointing.", "This is terrible", "I love that!", "Thanks, that really helped me a lot!", "They rejected it."):
            self.assertEqual(reference_signal(text), 1.0, text)


class CanonicalContextExamplesTest(unittest.TestCase):
    def test_internship_follow_up_uses_the_relevant_recent_messages(self):
        history = [
            "we discussed the internship yesterday",
            "The recruiter replied.",
            "They rejected it.",
        ]

        result = score_context_requirement("That's disappointing.", history)
        selected = select_context_messages(
            result.considered_history, result.similarities, result.level
        )

        self.assertEqual(result.level, "medium")
        self.assertEqual(
            selected,
            ["The recruiter replied.", "They rejected it."],
        )

    def test_thanks_after_an_unrelated_exchange_needs_no_context(self):
        history = ["The weather is nice today.", "Yes, it is sunny."]

        result = score_context_requirement("Thanks!", history)
        selected = select_context_messages(
            result.considered_history, result.similarities, result.level
        )

        self.assertEqual(result.level, "low")
        self.assertEqual(selected, [])

    def test_correction_follow_up_is_context_dependent(self):
        history = ["I finally got the results.", "That's great!"]

        result = score_context_requirement(
            "No, I meant the other results.", history
        )
        selected = select_context_messages(
            result.considered_history, result.similarities, result.level
        )

        self.assertEqual(result.level, "medium")
        self.assertEqual(selected, history)


if __name__ == "__main__":
    unittest.main()
