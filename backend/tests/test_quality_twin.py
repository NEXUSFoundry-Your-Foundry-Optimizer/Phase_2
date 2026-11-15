import numpy as np
import pytest

from backend.src.twins import quality_twin


def test_lfs_pointer_is_not_treated_as_a_loaded_model(tmp_path):
    model_path = tmp_path / "resnet.keras"
    model_path.write_text(
        "version https://git-lfs.github.com/spec/v1\n"
        "oid sha256:0000000000000000000000000000000000000000000000000000000000000000\n"
        "size 1\n",
        encoding="utf-8",
    )

    with pytest.raises(RuntimeError, match="git lfs pull"):
        quality_twin.QualityTwin(str(model_path))


@pytest.mark.parametrize(
    ("model_output", "expected_defect"),
    [
        ([[0.91]], True),
        ([[0.02, 0.98]], True),
        ([[0.98, 0.02]], False),
    ],
)
def test_inspection_uses_resnet_defect_probability(
    monkeypatch, tmp_path, model_output, expected_defect
):
    model_path = tmp_path / "resnet.keras"
    model_path.write_bytes(b"test model")
    image_path = tmp_path / "inspection.png"
    image_path.write_bytes(b"test image")

    model = type(
        "FakeModel",
        (),
        {"predict": lambda self, image, verbose=0: np.asarray(model_output)},
    )()
    monkeypatch.setattr(quality_twin.tf.keras.models, "load_model", lambda _: model)
    monkeypatch.setattr(
        quality_twin.cv2,
        "imread",
        lambda _: np.zeros((224, 224, 3), dtype=np.uint8),
    )

    service = quality_twin.QualityTwin(str(model_path))
    monkeypatch.setattr(service, "_save_to_database", lambda _: None)
    monkeypatch.setattr(service, "_update_twin_state", lambda _: None)

    result = service.process_inspection_image(str(image_path), "BATCH-TEST")

    assert result["defect_present"] is expected_defect
    assert result["raw_score"] == pytest.approx(model_output[0][-1])


def test_inspection_scales_rgb_input_to_zero_one(monkeypatch, tmp_path):
    model_path = tmp_path / "resnet.keras"
    model_path.write_bytes(b"test model")
    image_path = tmp_path / "inspection.png"
    image_path.write_bytes(b"test image")

    class FakeModel:
        image_input = None

        def predict(self, image, verbose=0):
            self.image_input = image
            return np.asarray([[0.9]])

    model = FakeModel()
    monkeypatch.setattr(quality_twin.tf.keras.models, "load_model", lambda _: model)
    monkeypatch.setattr(
        quality_twin.cv2,
        "imread",
        lambda _: np.full((224, 224, 3), 255, dtype=np.uint8),
    )

    service = quality_twin.QualityTwin(str(model_path))
    monkeypatch.setattr(service, "_save_to_database", lambda _: None)
    monkeypatch.setattr(service, "_update_twin_state", lambda _: None)

    service.process_inspection_image(str(image_path), "BATCH-TEST")

    assert model.image_input.dtype == np.float32
    assert model.image_input.min() == pytest.approx(1.0)
    assert model.image_input.max() == pytest.approx(1.0)
